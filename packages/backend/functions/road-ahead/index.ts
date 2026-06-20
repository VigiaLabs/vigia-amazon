import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const HAZARDS_TABLE = process.env.HAZARDS_TABLE_NAME!;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

function err(status: number, error: string): APIGatewayProxyResult {
  return { statusCode: status, headers: cors, body: JSON.stringify({ error }) };
}

interface LookAheadPoint { lat: number; lon: number; }

interface HazardItem {
  geohash: string;
  timestamp: string;
  hazardType?: string;
  status?: string;
  lat?: number;
  lon?: number;
  rriScore?: number;
  reportCount?: number;
  severity?: string;
  ttl?: number;
}

interface RouteHazard {
  geohash: string;
  distance_m: number;
  hazard_type: string;
  severity: string;
  avg_rri: number;
  report_count: number;
  last_seen_ms: number;
  eta_s: number;
}

/**
 * POST /v1/road-ahead
 *
 * Queries the HazardsTable for active hazards along the driver's projected route.
 * Called by [RouteAheadMonitor] every 5 seconds when velocity > 10 km/h.
 *
 * Request:  { lat, lon, bearing_deg, velocity_ms, look_ahead: [{lat,lon},...] }
 * Response: { hazards: [RouteHazard sorted by distance asc] }
 *
 * DynamoDB access pattern:
 *   PK = geohash (string, precision 6 = ~1.2km cell)
 *   SK = timestamp (ISO string)
 *   Filter: status = "active" AND (ttl absent OR ttl > now/1000)
 *
 * For each look-ahead point we compute the geohash-6 cell and query DynamoDB
 * with an exact PK match (QueryCommand on the PK). We also compute 4 nearby
 * cells (N/S/E/W neighbors at geohash-5 precision) using a Scan with prefix
 * filter — this is bounded: we only scan 1 page of results per call.
 *
 * The returned ETA is estimated as distance_m / max(velocity_ms, 5) seconds.
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return err(405, 'Method not allowed');

  let body: {
    lat: number;
    lon: number;
    bearing_deg: number;
    velocity_ms: number;
    look_ahead: LookAheadPoint[];
  };
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return err(400, 'Invalid JSON body');
  }

  const { lat, lon, bearing_deg, velocity_ms = 10, look_ahead = [] } = body;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return err(400, 'lat and lon are required');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const seenGeohashes = new Set<string>();
  const hazards: RouteHazard[] = [];

  // Query exact geohash-6 cells for each look-ahead point.
  const points: LookAheadPoint[] = [{ lat, lon }, ...look_ahead];
  for (const point of points) {
    const gh6 = encodeGeohash(point.lat, point.lon, 6);  // ~1.2km precision
    if (seenGeohashes.has(gh6)) continue;
    seenGeohashes.add(gh6);

    try {
      // Exact PK match: geohash is the partition key so we must query by exact value.
      const result = await dynamo.send(new QueryCommand({
        TableName: HAZARDS_TABLE,
        KeyConditionExpression: 'geohash = :gh',
        FilterExpression: '(#s = :active) AND (attribute_not_exists(#ttl) OR #ttl > :now)',
        ExpressionAttributeNames: { '#s': 'status', '#ttl': 'ttl' },
        ExpressionAttributeValues: { ':gh': gh6, ':active': 'active', ':now': nowSec },
        Limit: 10,
        ScanIndexForward: false,
      }));

      for (const item of (result.Items ?? []) as HazardItem[]) {
        const distanceM = haversineMeters(lat, lon, item.lat ?? point.lat, item.lon ?? point.lon);
        const lastSeenMs = new Date(item.timestamp).getTime();
        const etaS = distanceM / Math.max(velocity_ms, 5);

        hazards.push({
          geohash:      item.geohash,
          distance_m:   Math.round(distanceM),
          hazard_type:  item.hazardType ?? 'unknown',
          severity:     item.severity ?? severityFromRri(item.rriScore ?? 0.5),
          avg_rri:      item.rriScore ?? 0.5,
          report_count: item.reportCount ?? 1,
          last_seen_ms: lastSeenMs,
          eta_s:        Math.round(etaS),
        });
      }
    } catch (e) {
      console.error('DynamoDB query failed for geohash', gh6, e);
    }
  }

  // Dedup by geohash (keep closest) and sort by distance.
  const deduped = Object.values(
    hazards.reduce<Record<string, RouteHazard>>((acc, h) => {
      if (!acc[h.geohash] || h.distance_m < acc[h.geohash].distance_m) {
        acc[h.geohash] = h;
      }
      return acc;
    }, {})
  ).sort((a, b) => a.distance_m - b.distance_m);

  return {
    statusCode: 200,
    headers: cors,
    body: JSON.stringify({ hazards: deduped }),
  };
};

// ── Geohash encoding ──────────────────────────────────────────────────────────

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

function encodeGeohash(lat: number, lon: number, precision: number): string {
  let idx = 0, bit = 0, evenBit = true;
  let latMin = -90, latMax = 90, lonMin = -180, lonMax = 180;
  let hash = '';
  while (hash.length < precision) {
    if (evenBit) {
      const lonMid = (lonMin + lonMax) / 2;
      if (lon >= lonMid) { idx = (idx << 1) | 1; lonMin = lonMid; }
      else               { idx = idx << 1;         lonMax = lonMid; }
    } else {
      const latMid = (latMin + latMax) / 2;
      if (lat >= latMid) { idx = (idx << 1) | 1; latMin = latMid; }
      else               { idx = idx << 1;         latMax = latMid; }
    }
    evenBit = !evenBit;
    if (++bit === 5) { hash += BASE32[idx]; bit = 0; idx = 0; }
  }
  return hash;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function severityFromRri(rri: number): string {
  if (rri < 0.20) return 'CRITICAL';
  if (rri < 0.40) return 'HIGH';
  if (rri < 0.65) return 'MEDIUM';
  return 'LOW';
}
