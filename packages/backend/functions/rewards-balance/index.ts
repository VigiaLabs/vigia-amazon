import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.REWARDS_LEDGER_TABLE_NAME!;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Wallet-Timestamp,X-Wallet-Signature',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
};

function err(statusCode: number, error: string): APIGatewayProxyResult {
  return { statusCode, headers: cors, body: JSON.stringify({ error }) };
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };

  const wallet = event.queryStringParameters?.wallet_address;
  if (!wallet) return err(400, 'wallet_address required');

  // ── Ownership proof ─────────────────────────────────────────────────────────
  // The caller must prove they own the wallet by including:
  //   X-Wallet-Timestamp: <unix ms>
  //   X-Wallet-Signature: <base58 Ed25519 sig over "VIGIA-BALANCE:<wallet>:<timestamp>">
  //
  // This prevents any web origin from silently querying another user's balance
  // (the CORS '*' only allows the caller's own origin to read the response;
  // the signature ensures the caller controls the wallet they're querying).
  const headers = event.headers ?? {};
  const tsHeader  = headers['x-wallet-timestamp'] ?? headers['X-Wallet-Timestamp'];
  const sigHeader = headers['x-wallet-signature']  ?? headers['X-Wallet-Signature'];

  if (!tsHeader || !sigHeader) {
    return err(401, 'X-Wallet-Timestamp and X-Wallet-Signature headers required');
  }

  // Freshness: reject requests older than 5 minutes to prevent replay
  const tsMs = Number(tsHeader);
  if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > 5 * 60 * 1000) {
    return err(401, 'STALE_TIMESTAMP');
  }

  try {
    const decoded = bs58.decode(wallet);
    if (decoded.length !== 32) return err(400, 'Invalid Solana public key');

    const message   = new TextEncoder().encode(`VIGIA-BALANCE:${wallet}:${tsMs}`);
    const sigBytes  = bs58.decode(sigHeader);
    const pubBytes  = decoded;

    if (!nacl.sign.detached.verify(message, sigBytes, pubBytes)) {
      return err(401, 'INVALID_SIGNATURE');
    }

    const res = await dynamo.send(new GetCommand({ TableName: TABLE, Key: { wallet_address: wallet } }));
    const item = res.Item ?? {};
    return {
      statusCode: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet_address:  wallet,
        pending_balance: item.pending_balance?.toString() ?? '0',
        total_earned:    item.total_earned?.toString()    ?? '0',
        total_claimed:   item.total_claimed?.toString()   ?? '0',
        nonce:           item.nonce ?? 0,
        last_hazard_id:  item.last_hazard_id ?? null,
      }),
    };
  } catch (e: any) {
    return err(500, e.message);
  }
};
