/**
 * AttestationFn — IoT Core → Lambda handler.
 *
 * Triggered by IoT Rule SQL:
 *   SELECT encode(*, 'base64') AS payload, topic() AS topic
 *   FROM 'vigia/attest/+/hazard'
 *
 * Ports attestation.py (FastAPI MQTT path) to serverless TypeScript.
 * Pipeline:
 *   1. Base64 decode → MsgPack decode (schema v1)
 *   2. Anti-replay: DynamoDB conditional update on last_seq
 *   3. EtHashInput reconstruction (96-byte struct) + SHA-256 verify
 *   4. ECDSA P-256 signature verify via @noble/curves (prehashed)
 *   5. H3 res-10 geo-dedup → HazardsTable upsert
 *   6. Attestation log write
 */

import { createHash, X509Certificate } from 'crypto';
import { decode as msgpackDecode } from '@msgpack/msgpack';
import { p256 } from '@noble/curves/nist.js';
import { latLngToCell } from 'h3-js';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const PI_REGISTRY_TABLE   = process.env.PI_DEVICE_REGISTRY_TABLE_NAME!;
const HAZARDS_TABLE       = process.env.HAZARDS_TABLE_NAME!;
const ATTESTATION_LOG_TABLE = process.env.ATTESTATION_LOG_TABLE_NAME!;

// H3 resolution 10 ≈ 15 m hex edge — road hazard dedup granularity.
const H3_RESOLUTION = 10;
// Dedup window: skip writing a new hazard if one already exists at the same
// H3 cell + hazardType within this many milliseconds.
const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 h

// ── IoT Core event shape ────────────────────────────────────────────────────

interface IoTRuleEvent {
  payload: string;  // base64-encoded MsgPack bytes
  topic:   string;  // e.g. "vigia/attest/vigia-001/hazard"
  ts?:     number;  // IoT Core timestamp() — milliseconds since epoch
}

// ── EtHashInput struct (96 bytes, little-endian) ───────────────────────────
// Must be byte-for-byte identical to 03_pico2_firmware_contracts.md §6.3.2.

function buildEtHashInput(deviceIdHex: string, se: Record<string, any>, frame: Record<string, any>): Buffer {
  const buf = Buffer.alloc(96, 0);
  let off = 0;

  // device_id: 16 bytes from hex (UUID format, dashes stripped)
  const idBytes = Buffer.from(deviceIdHex.replace(/-/g, ''), 'hex');
  if (idBytes.length !== 16) throw new AttestationError(`device_id must be 16-byte hex; got ${idBytes.length} bytes`);
  idBytes.copy(buf, off); off += 16;

  // mcu_timestamp_us: uint64 LE
  buf.writeBigUInt64LE(BigInt(se.mcu_timestamp_us ?? 0), off); off += 8;

  // sequence: uint32 LE
  buf.writeUInt32LE(se.sequence ?? 0, off); off += 4;

  // quaternion: float32 LE × 4
  buf.writeFloatLE(se.q_w ?? 0.0, off); off += 4;
  buf.writeFloatLE(se.q_x ?? 0.0, off); off += 4;
  buf.writeFloatLE(se.q_y ?? 0.0, off); off += 4;
  buf.writeFloatLE(se.q_z ?? 1.0, off); off += 4;

  // linear accel: float32 LE × 3
  buf.writeFloatLE(se.accel_x ?? 0.0, off); off += 4;
  buf.writeFloatLE(se.accel_y ?? 0.0, off); off += 4;
  buf.writeFloatLE(se.accel_z ?? 0.0, off); off += 4;

  // imu_cal_status: uint8 + 3 pad (buf is zeroed, so skip pad)
  buf.writeUInt8(se.imu_cal_status ?? 0, off); off += 4;

  // lat, lon: float64 LE × 2
  buf.writeDoubleLE(frame.lat ?? 0.0, off); off += 8;
  buf.writeDoubleLE(frame.lon ?? 0.0, off); off += 8;

  // alt_m, speed_ms, course_deg: float32 LE × 3
  buf.writeFloatLE(frame.alt_m   ?? 0.0, off); off += 4;
  buf.writeFloatLE(frame.speed_ms ?? 0.0, off); off += 4;
  buf.writeFloatLE(0.0, off); off += 4; // course_deg not in FrameMetadata schema

  // gps_fix_type: uint8, satellites: uint8 (zero), 2 pad
  buf.writeUInt8(se.gps_fix_type ?? 0, off); off += 1;
  buf.writeUInt8(0, off); off += 1;        // satellites not separately stored
  off += 2;                                // padding

  // hdop: float32 LE
  buf.writeFloatLE(frame.hdop ?? 99.9, off); off += 4;

  if (off !== 96) throw new Error(`EtHashInput size ${off} ≠ 96`);
  return buf;
}

// ── ECDSA P-256 verification ────────────────────────────────────────────────

function extractRawP256PublicKey(certPem: string): Uint8Array {
  const cert = new X509Certificate(certPem);
  const spki = cert.publicKey.export({ type: 'spki', format: 'der' }) as Buffer;
  // SPKI for P-256 uncompressed: last 65 bytes = 0x04 || x(32) || y(32)
  return new Uint8Array(spki.subarray(spki.length - 65));
}

function verifyEcdsaP256Prehashed(
  certPem:  string,
  etHash:   Uint8Array,   // 32-byte SHA-256 digest
  sigRaw:   Uint8Array,   // 64-byte ATECC608A raw R‖S
): void {
  const pubKey = extractRawP256PublicKey(certPem);
  // prehash:false → noble uses etHash directly without re-hashing
  // lowS:false   → ATECC does not enforce low-S canonical form
  const ok = p256.verify(sigRaw, etHash, pubKey, { prehash: false, lowS: false });
  if (!ok) throw new SecurityError('ECDSA P-256 verification failed — possible Sybil attack or firmware bug');
}

// ── Anti-replay (monotonic sequence watermark) ──────────────────────────────

async function checkAndAdvanceSequence(deviceId: string, sequence: number): Promise<void> {
  try {
    await db.send(new UpdateCommand({
      TableName: PI_REGISTRY_TABLE,
      Key: { device_id: deviceId },
      UpdateExpression: 'SET last_seq = :seq, last_seen = :now',
      // Accept if no record yet OR new seq strictly greater than stored seq
      ConditionExpression: 'attribute_not_exists(last_seq) OR last_seq < :seq',
      ExpressionAttributeValues: { ':seq': sequence, ':now': Date.now() },
    }));
  } catch (e: any) {
    if (e.name === 'ConditionalCheckFailedException') {
      throw new SecurityError(`Replay detected for device=${deviceId} seq=${sequence}`);
    }
    throw e;
  }
}

// ── Device cert lookup ──────────────────────────────────────────────────────

async function getDeviceCert(deviceId: string): Promise<string> {
  const result = await db.send(new GetCommand({
    TableName: PI_REGISTRY_TABLE,
    Key: { device_id: deviceId },
    ProjectionExpression: 'cert_pem',
  }));
  if (!result.Item?.cert_pem) {
    throw new AuthorizationError(`Device not provisioned in fleet registry: ${deviceId}`);
  }
  return result.Item.cert_pem as string;
}

// ── H3 geo-dedup → HazardsTable upsert ─────────────────────────────────────

async function upsertHazard(
  deviceId:   string,
  sequence:   number,
  lat:        number,
  lon:        number,
  rriScore:   number,
  hazardType: string,
  ts:         number,   // epoch ms
): Promise<void> {
  const h3Index = latLngToCell(lat, lon, H3_RESOLUTION);
  const windowStart = new Date(ts - DEDUP_WINDOW_MS).toISOString();

  // Query h3-hazardtype-index for a recent entry at the same cell
  const existing = await db.send(new QueryCommand({
    TableName: HAZARDS_TABLE,
    IndexName: 'h3-hazardtype-index',
    KeyConditionExpression: 'h3_index = :h AND hazardType = :t',
    FilterExpression: '#ts > :ws',
    ExpressionAttributeNames: { '#ts': 'timestamp' },
    ExpressionAttributeValues: {
      ':h': h3Index,
      ':t': hazardType,
      ':ws': windowStart,
    },
    Limit: 1,
  }));

  if (existing.Items && existing.Items.length > 0) {
    // Existing hazard in this H3 cell — update severity and last-seen
    const item = existing.Items[0];
    await db.send(new UpdateCommand({
      TableName: HAZARDS_TABLE,
      Key: { geohash: item.geohash, timestamp: item.timestamp },
      UpdateExpression: [
        'SET severity_score = :rri',
        'observation_count = observation_count + :one',
        'last_seen = :now',
        'last_device_id = :did',
      ].join(', '),
      ExpressionAttributeValues: {
        ':rri': rriScore,
        ':one': 1,
        ':now': new Date(ts).toISOString(),
        ':did': deviceId,
      },
    }));
  } else {
    // New hazard — write with geohash PK for existing GET /hazards queries
    // ngeohash not imported here: derive geohash from H3 center as simple lat/lon string
    const geohash = `${lat.toFixed(5)},${lon.toFixed(5)}`;
    await db.send(new PutCommand({
      TableName: HAZARDS_TABLE,
      Item: {
        geohash,
        timestamp:         new Date(ts).toISOString(),
        hazardType,
        lat, lon,
        h3_index:          h3Index,
        severity_score:    rriScore,
        observation_count: 1,
        first_seen:        new Date(ts).toISOString(),
        last_seen:         new Date(ts).toISOString(),
        last_device_id:    deviceId,
        status:            'PENDING',   // Bedrock orchestrator promotes to VERIFIED
        source:            'hardware_attested',
        device_seq:        sequence,
        ttl: Math.floor(ts / 1000) + 86400 * 30,
      },
    }));
  }
}

// ── Attestation log ─────────────────────────────────────────────────────────

async function logVerifiedEvent(deviceId: string, sequence: number, payload: Record<string, any>): Promise<void> {
  await db.send(new PutCommand({
    TableName: ATTESTATION_LOG_TABLE,
    Item: {
      pk:         `${deviceId}#${sequence}`,
      device_id:  deviceId,
      sequence,
      logged_at:  new Date().toISOString(),
      rri_score:  payload.hazard_event?.rri_score,
      iss_score:  payload.hazard_event?.iss_score,
      lat:        payload.frame_metadata?.[0]?.lat,
      lon:        payload.frame_metadata?.[0]?.lon,
      ttl:        Math.floor(Date.now() / 1000) + 86400 * 90,
    },
  }));
}

// ── Error types ─────────────────────────────────────────────────────────────

class AttestationError  extends Error { constructor(m: string) { super(m); this.name = 'AttestationError'; } }
class SecurityError     extends AttestationError { constructor(m: string) { super(m); this.name = 'SecurityError'; } }
class AuthorizationError extends AttestationError { constructor(m: string) { super(m); this.name = 'AuthorizationError'; } }

// ── Handler ─────────────────────────────────────────────────────────────────

export const handler = async (event: IoTRuleEvent): Promise<void> => {
  const tsMs = event.ts ?? Date.now();

  // 1. Decode
  const rawBytes = Buffer.from(event.payload, 'base64');
  const payload = msgpackDecode(rawBytes) as Record<string, any>;

  if (payload.version !== 1) {
    throw new AttestationError(`Unsupported payload version: ${payload.version}`);
  }

  const deviceId: string = payload.device_id;
  const se = payload.signed_et as Record<string, any>;
  const frames = (payload.frame_metadata as any[]) ?? [];
  const lastFrame = frames[frames.length - 1] ?? {};
  const hazardEvent = payload.hazard_event ?? {};

  if (!deviceId || !se) throw new AttestationError('Missing device_id or signed_et');

  // 2. EtHashInput reconstruction + SHA-256 integrity check
  const etInput  = buildEtHashInput(deviceId, se, lastFrame);
  const computed = createHash('sha256').update(etInput).digest();
  const received = Buffer.from(se.et_hash as Uint8Array);
  if (!computed.equals(received)) {
    throw new SecurityError(
      `et_hash mismatch: computed=${computed.toString('hex')} received=${received.toString('hex')}`
    );
  }

  // 3. ECDSA P-256 signature verify
  const certPem = await getDeviceCert(deviceId);
  verifyEcdsaP256Prehashed(certPem, new Uint8Array(received), new Uint8Array(se.ecdsa_sig as Uint8Array));

  // 4. Anti-replay — advance the sequence watermark ONLY after the signature is
  // proven valid. Advancing before verification would let a forged/unauthenticated
  // packet poison the watermark and lock out the device's later legitimate messages.
  await checkAndAdvanceSequence(deviceId, se.sequence);

  // 5. Geo-dedup + HazardsTable upsert
  if (typeof lastFrame.lat === 'number' && typeof lastFrame.lon === 'number') {
    const hazardType = hazardEvent.rri_score > 0.7 ? 'POTHOLE'
                     : hazardEvent.iss_score  > 0.6 ? 'ROUGH_ROAD'
                     : 'ROAD_ANOMALY';
    await upsertHazard(
      deviceId, se.sequence,
      lastFrame.lat, lastFrame.lon,
      hazardEvent.rri_score ?? 0,
      hazardType, tsMs,
    );
  }

  // 6. Attestation log
  await logVerifiedEvent(deviceId, se.sequence, payload);

  console.log(`[Attestation] VERIFIED device=${deviceId} seq=${se.sequence} rri=${hazardEvent.rri_score}`);
};
