/**
 * ClaimDeviceFn — POST /claim-device
 *
 * Enforces 1:1 binding between a Pi hardware unit and a wallet (phone account).
 *
 * Invariants:
 *   - One device_id  maps to exactly one wallet_pubkey  (hardware exclusivity)
 *   - One wallet_pubkey maps to exactly one device_id   (account exclusivity)
 *
 * Returns 200 on success or idempotent re-claim by the same pair.
 * Returns 409 {"detail":"device_taken"|"wallet_taken"} on conflict.
 */

import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const db    = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.DEVICE_BINDINGS_TABLE_NAME!;

const CORS = {
  'Content-Type':                 'application/json',
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const handler: APIGatewayProxyHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  let device_id: string, wallet_pubkey: string;
  try {
    ({ device_id, wallet_pubkey } = JSON.parse(event.body ?? '{}'));
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  if (!device_id || !wallet_pubkey) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'device_id and wallet_pubkey required' }) };
  }

  // ── Check if device is already claimed ─────────────────────────────────────
  const deviceRow = await db.send(new GetCommand({ TableName: TABLE, Key: { device_id } }));
  if (deviceRow.Item) {
    if (deviceRow.Item.wallet_pubkey === wallet_pubkey) {
      // Idempotent: same pair re-claiming — OK
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ status: 'ok' }) };
    }
    return { statusCode: 409, headers: CORS, body: JSON.stringify({ detail: 'device_taken' }) };
  }

  // ── Check if wallet already owns a different device ─────────────────────────
  const walletRows = await db.send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'wallet-pubkey-index',
    KeyConditionExpression: 'wallet_pubkey = :w',
    ExpressionAttributeValues: { ':w': wallet_pubkey },
    Limit: 1,
  }));
  if (walletRows.Items?.length) {
    const existing = walletRows.Items[0];
    if (existing.device_id !== device_id) {
      return { statusCode: 409, headers: CORS, body: JSON.stringify({ detail: 'wallet_taken' }) };
    }
  }

  // ── Atomic write with conditional expression (race guard) ───────────────────
  try {
    await db.send(new PutCommand({
      TableName: TABLE,
      Item: {
        device_id,
        wallet_pubkey,
        claimed_at: new Date().toISOString(),
      },
      ConditionExpression: 'attribute_not_exists(device_id)',
    }));
  } catch (e: any) {
    if (e.name === 'ConditionalCheckFailedException') {
      // Lost a write race — device was claimed by another wallet between our check and write
      return { statusCode: 409, headers: CORS, body: JSON.stringify({ detail: 'device_taken' }) };
    }
    console.error('[ClaimDevice] DynamoDB error:', e);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Internal error' }) };
  }

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ status: 'ok' }) };
};
