import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
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

    // ── Ed25519 signature verification ───────────────────────────────────────
    const payloadStr = `VIGIA:${hazardType}:${lat}:${lon}:${timestamp}:${confidence}`;
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
