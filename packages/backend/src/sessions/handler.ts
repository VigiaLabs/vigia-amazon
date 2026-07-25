import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { createHash } from 'crypto';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const SESSION_FILES_TABLE = process.env.SESSION_FILES_TABLE!;
const LEDGER_ENTRIES_TABLE = process.env.LEDGER_ENTRIES_TABLE!;

interface SessionData {
  userId: string;
  geohash7: string;
  timestamp: string;
  hazardCount: number;
  verifiedCount: number;
  contributorId: string;
  status: 'draft' | 'finalized' | 'archived';
  location?: {
    continent?: string;
    country?: string;
    region?: string;
    city?: string;
  };
  hazards: any[];
  metadata?: any;
}

function computeHash(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * A-CRIT-1: identity comes ONLY from the Cognito JWT the API Gateway authorizer
 * validated — never from the request body or query string. Returns null when the
 * request is unauthenticated, and the handler fails closed (401). Client-supplied
 * userId / contributorId / fileHash are ignored entirely.
 */
function getAuthUserId(event: APIGatewayProxyEvent): string | null {
  const claims = (event.requestContext as any)?.authorizer?.claims;
  const sub = claims?.sub;
  return typeof sub === 'string' && sub.length > 0 ? sub : null;
}

const json = (statusCode: number, obj: unknown): APIGatewayProxyResult => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(obj),
});

async function getParentHash(userId: string, geohash7: string): Promise<string> {
  const result = await docClient.send(new QueryCommand({
    TableName: SESSION_FILES_TABLE,
    IndexName: 'geohash7-timestamp-index',
    KeyConditionExpression: 'geohash7 = :geohash',
    ExpressionAttributeValues: { ':geohash': geohash7 },
    ScanIndexForward: false,
    Limit: 1,
  }));

  return result.Items?.[0]?.fileHash || 'genesis';
}

async function writeLedgerEntry(sessionId: string, action: string, contributorId: string, previousHash: string) {
  const timestamp = new Date().toISOString();
  const payload = `${timestamp}${sessionId}${action}${previousHash}${contributorId}`;
  const currentHash = computeHash(payload);

  await docClient.send(new PutCommand({
    TableName: LEDGER_ENTRIES_TABLE,
    Item: {
      ledgerId: 'ledger',
      timestamp,
      sessionId,
      action,
      previousHash,
      currentHash,
      contributorId,
    },
  }));
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { httpMethod, pathParameters, body } = event;

  // A-CRIT-1: fail closed — every route requires an authenticated identity.
  const userId = getAuthUserId(event);
  if (!userId) return json(401, { error: 'unauthenticated' });

  try {
    switch (httpMethod) {
      case 'POST': {
        // Create session. Identity (userId, contributorId) is derived from the
        // JWT — client-supplied userId/contributorId/fileHash are ignored.
        const data: SessionData = JSON.parse(body || '{}');
        const sessionId = `${data.geohash7}#${data.timestamp}`;

        const payload = `${sessionId}${data.geohash7}${data.timestamp}${data.hazardCount}${data.verifiedCount}${userId}`;
        const fileHash = computeHash(payload);
        const parentHash = await getParentHash(userId, data.geohash7);

        const session = {
          userId,
          sessionId,
          geohash7: data.geohash7,
          timestamp: data.timestamp,
          hazardCount: data.hazardCount,
          verifiedCount: data.verifiedCount,
          contributorId: userId,
          fileHash,
          parentHash,
          status: data.status || 'draft',
          location: data.location || {},
          hazards: data.hazards,
          metadata: data.metadata || {},
          ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60), // 90 days
        };

        // Do not silently overwrite an existing session belonging to this owner.
        await docClient.send(new PutCommand({
          TableName: SESSION_FILES_TABLE,
          Item: session,
          ConditionExpression: 'attribute_not_exists(sessionId)',
        }));

        await writeLedgerEntry(sessionId, 'created', userId, parentHash);

        return json(201, session);
      }

      case 'GET': {
        if (pathParameters?.sessionId) {
          // Get single session — scoped to the caller's own partition.
          const result = await docClient.send(new GetCommand({
            TableName: SESSION_FILES_TABLE,
            Key: { userId, sessionId: pathParameters.sessionId },
          }));

          if (!result.Item) return json(404, { error: 'Session not found' });
          return json(200, result.Item);
        }
        // List — only the caller's own sessions.
        const result = await docClient.send(new QueryCommand({
          TableName: SESSION_FILES_TABLE,
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: { ':userId': userId },
          Limit: 100,
        }));
        return json(200, { sessions: result.Items || [] });
      }

      case 'PUT': {
        // Update session — only the caller's own row; integrity fields are
        // recomputed server-side, never taken from the client.
        const data = JSON.parse(body || '{}');
        const sessionId = pathParameters?.sessionId;
        if (!sessionId) return json(400, { error: 'sessionId required' });

        // previousHash for the ledger comes from the stored record, not the client.
        const current = await docClient.send(new GetCommand({
          TableName: SESSION_FILES_TABLE,
          Key: { userId, sessionId },
        }));
        if (!current.Item) return json(404, { error: 'Session not found' });

        try {
          await docClient.send(new UpdateCommand({
            TableName: SESSION_FILES_TABLE,
            Key: { userId, sessionId },
            UpdateExpression: 'SET #status = :status, verifiedCount = :verifiedCount',
            ConditionExpression: 'attribute_exists(sessionId)',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
              ':status': data.status,
              ':verifiedCount': data.verifiedCount,
            },
          }));
        } catch (e: any) {
          if (e?.name === 'ConditionalCheckFailedException') return json(404, { error: 'Session not found' });
          throw e;
        }

        await writeLedgerEntry(sessionId, 'updated', userId, current.Item.fileHash || 'genesis');
        return json(200, { success: true });
      }

      case 'DELETE': {
        // Delete — only the caller's own row.
        const sessionId = decodeURIComponent(pathParameters?.sessionId || '');
        if (!sessionId) return json(400, { error: 'sessionId required' });

        try {
          await docClient.send(new DeleteCommand({
            TableName: SESSION_FILES_TABLE,
            Key: { userId, sessionId },
            ConditionExpression: 'attribute_exists(sessionId)',
          }));
        } catch (e: any) {
          if (e?.name === 'ConditionalCheckFailedException') return json(404, { error: 'Session not found' });
          throw e;
        }
        return json(200, { success: true });
      }

      default:
        return json(405, { error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error:', error);
    // Do not leak internal error detail to the caller.
    return json(500, { error: 'Internal server error' });
  }
}
