import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const REGISTRY_TABLE = process.env.DEVICE_REGISTRY_TABLE_NAME!;

// Proof-of-possession message the client must Ed25519-sign with the device's
// private key. Binds the signature to this endpoint (anti cross-protocol replay).
const REGISTER_PREFIX = 'VIGIA-REGISTER:';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  try {
    const { device_address, signature } = JSON.parse(event.body || '{}');

    // Validate Solana public key format (base58, 32-44 chars)
    if (!device_address || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(device_address)) {
      return { statusCode: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'INVALID_ADDRESS' }) };
    }

    // ── Proof-of-possession — caller must prove they hold the private key ──────
    // Prevents registering wallets you don't control (Sybil identity farming).
    // Client signs `VIGIA-REGISTER:<device_address>` with the device key (base58 sig).
    if (typeof signature !== 'string') {
      return { statusCode: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'SIGNATURE_REQUIRED' }) };
    }
    let powOk = false;
    try {
      const msg    = new TextEncoder().encode(`${REGISTER_PREFIX}${device_address}`);
      const sigB   = bs58.decode(signature);
      const pubB   = bs58.decode(device_address);
      powOk = pubB.length === 32 && sigB.length === 64 &&
              nacl.sign.detached.verify(msg, sigB, pubB);
    } catch {
      powOk = false;
    }
    if (!powOk) {
      return { statusCode: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'INVALID_SIGNATURE' }) };
    }

    try {
      // Idempotent write — no error if device already registered
      await dynamodb.send(new PutCommand({
        TableName: REGISTRY_TABLE,
        Item: { device_address, registered_at: new Date().toISOString() },
        ConditionExpression: 'attribute_not_exists(device_address)',
      }));
      return { statusCode: 201, headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'registered', device_address }) };
    } catch (e: any) {
      if (e.name === 'ConditionalCheckFailedException') {
        return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'already_registered', device_address }) };
      }
      throw e;
    }
  } catch (error) {
    console.error('[RegisterDevice] Error:', error);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Internal error' }) };
  }
};
