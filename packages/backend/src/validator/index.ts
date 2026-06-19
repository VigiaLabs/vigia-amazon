import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createHash } from 'crypto';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import ngeohash from 'ngeohash';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const handler: APIGatewayProxyHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  try {
    const payload = JSON.parse(event.body || '{}');
    const { hazardType, lat, lon, timestamp, confidence, signature, publicKey, frame_base64 } = payload;

    // ── Input validation — reject malformed/out-of-range before any trust ─────
    // Values are validated but never mutated: the Ed25519 signature covers the
    // exact wire values, so coercion would break verification.
    const bad =
      typeof hazardType !== 'string' || hazardType.length === 0 || hazardType.length > 64 ||
      typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90  || lat > 90  ||
      typeof lon !== 'number' || !Number.isFinite(lon) || lon < -180 || lon > 180 ||
      typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 1 ||
      typeof timestamp !== 'number' || !Number.isFinite(timestamp) ||
      typeof signature !== 'string' || typeof publicKey !== 'string';
    if (bad) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'INVALID_PAYLOAD' }) };
    }

    // ── Timestamp freshness — bound replay window (unit-aware: s or ms) ───────
    const tsMs = timestamp > 1e12 ? timestamp : timestamp * 1000;
    const FRESHNESS_MS = 10 * 60 * 1000;
    if (Math.abs(Date.now() - tsMs) > FRESHNESS_MS) {
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'STALE_TIMESTAMP' }) };
    }

    // ── Frame integrity (H2) ─────────────────────────────────────────────────
    // If the client supplies a frame, include its SHA-256 digest in the signed
    // message. This prevents a man-in-the-middle swapping the raw frame bytes
    // after the signature is produced. Clients that don't send a frame omit the
    // field; servers accept both forms so rollout can be gradual.
    let frameSha256: string | null = null;
    if (frame_base64) {
      frameSha256 = createHash('sha256')
        .update(Buffer.from(frame_base64, 'base64'))
        .digest('hex');
    }

    // ── Ed25519 signature verification ───────────────────────────────────────
    // Payload format (with frame): VIGIA:<type>:<lat>:<lon>:<ts>:<conf>:<sha256>
    // Payload format (no frame):   VIGIA:<type>:<lat>:<lon>:<ts>:<conf>
    const payloadStr = frameSha256
      ? `VIGIA:${hazardType}:${lat}:${lon}:${timestamp}:${confidence}:${frameSha256}`
      : `VIGIA:${hazardType}:${lat}:${lon}:${timestamp}:${confidence}`;
    const message = new TextEncoder().encode(payloadStr);
    const sigBytes = bs58.decode(signature);
    const pubkeyBytes = bs58.decode(publicKey);

    const valid = nacl.sign.detached.verify(message, sigBytes, pubkeyBytes);
    if (!valid) {
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'INVALID_SIGNATURE' }) };
    }

    // ── Device registry check (base58 pubkey as key) ─────────────────────────
    const { Item } = await dynamodb.send(new GetCommand({
      TableName: process.env.DEVICE_REGISTRY_TABLE_NAME!,
      Key: { device_address: publicKey },
    }));
    if (!Item) {
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'DEVICE_NOT_REGISTERED' }) };
    }
    // Enforce slashing — a blacklisted (slashed) device may no longer submit.
    if (Item.blacklisted === true) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'DEVICE_BLACKLISTED' }) };
    }

    const geohash = ngeohash.encode(lat, lon, 7);
    const hazardId = `${geohash}#${timestamp}`;

    // ── S3 Pointer Pattern ───────────────────────────────────────────────────
    let s3_key: string | null = null;
    if (frame_base64) {
      s3_key = `frames/${geohash}/${timestamp}.jpg`;
      await s3.send(new PutObjectCommand({
        Bucket: process.env.FRAMES_BUCKET_NAME!,
        Key: s3_key,
        Body: Buffer.from(frame_base64, 'base64'),
        ContentType: 'image/jpeg',
      }));
    }

    // ── Write PENDING — Orchestrator handles all AI ──────────────────────────
    await dynamodb.send(new PutCommand({
      TableName: process.env.HAZARDS_TABLE_NAME!,
      Item: {
        geohash, timestamp, hazardType, lat, lon, confidence, signature,
        driverWalletAddress: publicKey, // base58 Solana pubkey
        status: 'PENDING',
        s3_key,
        ttl: Math.floor(Date.now() / 1000) + 86400 * 30,
      },
    }));

    return { statusCode: 202, headers: CORS, body: JSON.stringify({ hazardId, status: 'PENDING' }) };
  } catch (error) {
    console.error('[Validator] Error:', error);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'INTERNAL_ERROR' }) };
  }
};
