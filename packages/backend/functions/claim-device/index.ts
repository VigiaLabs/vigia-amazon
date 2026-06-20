/**
 * ClaimDeviceFn — POST /claim-device
 *
 * Enforces 1:1 binding between a Pi hardware unit and a wallet (phone account).
 *
 * Invariants:
 *   - One device_id  maps to exactly one wallet_pubkey  (hardware exclusivity)
 *   - One wallet_pubkey maps to exactly one device_id   (account exclusivity)
 *
 * P0-6 fix — binding now requires DUAL proof-of-possession over the message
 *   VIGIA-BIND:<device_id>:<wallet_pubkey>:<ts>
 *   - wallet_sig:  Ed25519 signature by wallet_pubkey (base58 key + base58 sig)
 *   - device_sig:  ATECC608A ECDSA P-256 raw R‖S (hex), verified against the
 *                  device's X.509 cert in PiDeviceRegistry (same trust root as
 *                  AttestationFn). Proves physical possession of the Pi.
 * Both must be fresh (±5 min). Without the device proof, an attacker could bind a
 * Pi they do not hold to their own wallet and steal its attested reward stream.
 *
 * Returns 200 on success or idempotent re-claim by the same proven pair.
 * Returns 401 on proof failure, 409 {"detail":"device_taken"|"wallet_taken"} on conflict.
 */

import { APIGatewayProxyHandler } from 'aws-lambda';
import { createHash, X509Certificate } from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { p256 } from '@noble/curves/nist.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

const db    = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.DEVICE_BINDINGS_TABLE_NAME!;
const PI_REGISTRY_TABLE = process.env.PI_DEVICE_REGISTRY_TABLE_NAME!;
const BIND_FRESHNESS_MS = 5 * 60 * 1000;

const CORS = {
  'Content-Type':                 'application/json',
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function resp(status: number, body: object) {
  return { statusCode: status, headers: CORS, body: JSON.stringify(body) };
}

// Ed25519 wallet proof-of-possession.
function verifyWalletSig(msg: string, walletPubkeyB58: string, sigB58: string): boolean {
  try {
    const pub = bs58.decode(walletPubkeyB58);
    if (pub.length !== 32) return false;
    return nacl.sign.detached.verify(new TextEncoder().encode(msg), bs58.decode(sigB58), pub);
  } catch { return false; }
}

// ATECC608A ECDSA P-256 proof-of-possession, verified against the device's
// registered X.509 certificate (same extraction + verify as AttestationFn).
async function verifyDeviceSig(deviceId: string, msg: string, sigHex: string): Promise<boolean> {
  const row = await db.send(new GetCommand({
    TableName: PI_REGISTRY_TABLE,
    Key: { device_id: deviceId },
    ProjectionExpression: 'cert_pem',
  }));
  const certPem = row.Item?.cert_pem as string | undefined;
  if (!certPem) return false;
  try {
    const cert = new X509Certificate(certPem);
    const spki = cert.publicKey.export({ type: 'spki', format: 'der' }) as Buffer;
    const pub  = new Uint8Array(spki.subarray(spki.length - 65)); // 0x04 || x || y
    const hash = createHash('sha256').update(msg, 'utf8').digest();
    const sig  = Uint8Array.from(Buffer.from(sigHex, 'hex'));
    // lowS:false matches ATECC raw output (see P0-7 — canonicalize in firmware).
    return p256.verify(sig, new Uint8Array(hash), pub, { prehash: false, lowS: false });
  } catch { return false; }
}

export const handler: APIGatewayProxyHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  let device_id: string, wallet_pubkey: string, ts: unknown, wallet_sig: string, device_sig: string;
  try {
    ({ device_id, wallet_pubkey, ts, wallet_sig, device_sig } = JSON.parse(event.body ?? '{}'));
  } catch {
    return resp(400, { error: 'Invalid JSON' });
  }

  if (!device_id || !wallet_pubkey || !ts || !wallet_sig || !device_sig) {
    return resp(400, { error: 'device_id, wallet_pubkey, ts, wallet_sig, device_sig required' });
  }

  // ── P0-6: freshness + dual proof-of-possession ─────────────────────────────
  const tsMs = Number(ts);
  if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > BIND_FRESHNESS_MS) {
    return resp(401, { detail: 'stale_or_invalid_timestamp' });
  }
  const msg = `VIGIA-BIND:${device_id}:${wallet_pubkey}:${tsMs}`;
  if (!verifyWalletSig(msg, wallet_pubkey, wallet_sig)) {
    return resp(401, { detail: 'invalid_wallet_signature' });
  }
  if (!await verifyDeviceSig(device_id, msg, device_sig)) {
    return resp(401, { detail: 'invalid_device_signature' });
  }

  // ── Check if device is already claimed ─────────────────────────────────────
  const deviceRow = await db.send(new GetCommand({ TableName: TABLE, Key: { device_id } }));
  if (deviceRow.Item) {
    if (deviceRow.Item.wallet_pubkey === wallet_pubkey) {
      return resp(200, { status: 'ok' }); // idempotent re-claim by the proven pair
    }
    return resp(409, { detail: 'device_taken' });
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
      return resp(409, { detail: 'wallet_taken' });
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
      return resp(409, { detail: 'device_taken' });
    }
    console.error('[ClaimDevice] DynamoDB error:', e);
    return resp(500, { error: 'Internal error' });
  }

  return resp(200, { status: 'ok' });
};
