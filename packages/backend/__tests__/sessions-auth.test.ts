/**
 * A-CRIT-1 regression: the Sessions CRUD handler must
 *   1. fail closed (401) when there is no authenticated identity,
 *   2. derive the owner from JWT claims (never the body/query),
 *   3. scope reads/writes to the caller's own partition.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
  DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent } from 'aws-lambda';

const dynamoMock = mockClient(DynamoDBDocumentClient);

process.env.SESSION_FILES_TABLE = 'SessionFiles';
process.env.LEDGER_ENTRIES_TABLE = 'Ledger';

const { handler } = await import('../src/sessions/handler');

function evt(overrides: Partial<APIGatewayProxyEvent> & { sub?: string | null }): APIGatewayProxyEvent {
  const { sub, ...rest } = overrides;
  const requestContext: any = sub === undefined
    ? {}
    : { authorizer: { claims: sub === null ? {} : { sub } } };
  return {
    httpMethod: 'GET',
    pathParameters: null,
    queryStringParameters: null,
    body: null,
    headers: {},
    requestContext,
    ...rest,
  } as unknown as APIGatewayProxyEvent;
}

beforeEach(() => dynamoMock.reset());

describe('sessions handler — A-CRIT-1', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const res = await handler(evt({ httpMethod: 'GET', sub: undefined }));
    expect(res.statusCode).toBe(401);
  });

  it('rejects requests whose authorizer has no sub claim', async () => {
    const res = await handler(evt({ httpMethod: 'GET', sub: null }));
    expect(res.statusCode).toBe(401);
  });

  it('lists only the caller-owned partition, ignoring a spoofed query userId', async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [{ userId: 'user-A', sessionId: 's1' }] });
    const res = await handler(evt({
      httpMethod: 'GET',
      sub: 'user-A',
      queryStringParameters: { userId: 'victim-B' },
    }));
    expect(res.statusCode).toBe(200);
    const call = dynamoMock.commandCalls(QueryCommand)[0].args[0].input as any;
    expect(call.ExpressionAttributeValues[':userId']).toBe('user-A'); // NOT victim-B
  });

  it('creates a session owned by the JWT sub, not the client-supplied userId/contributorId', async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [] }); // getParentHash
    dynamoMock.on(PutCommand).resolves({});
    const res = await handler(evt({
      httpMethod: 'POST',
      sub: 'user-A',
      body: JSON.stringify({
        userId: 'victim-B', contributorId: 'victim-B', fileHash: 'forged',
        geohash7: 'tdr1bhq', timestamp: '2026-07-25T00:00:00Z',
        hazardCount: 1, verifiedCount: 0, hazards: [],
      }),
    }));
    expect(res.statusCode).toBe(201);
    const put = dynamoMock.commandCalls(PutCommand).find(
      (c) => (c.args[0].input as any).TableName === 'SessionFiles',
    )!.args[0].input as any;
    expect(put.Item.userId).toBe('user-A');
    expect(put.Item.contributorId).toBe('user-A');
    // fileHash is recomputed server-side, never the client's forged value
    expect(put.Item.fileHash).not.toBe('forged');
    // create is guarded against overwriting an existing owned row
    expect(put.ConditionExpression).toContain('attribute_not_exists');
  });
});
