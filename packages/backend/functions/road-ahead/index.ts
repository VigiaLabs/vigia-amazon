import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import * as https from 'https';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const HAZARDS_TABLE  = process.env.HAZARDS_TABLE_NAME!;
const GEOMETRY_TABLE = process.env.GEOMETRY_CACHE_TABLE_NAME ?? HAZARDS_TABLE; // falls back to same table

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

interface RoadGeometryAdvisory {
  type: 'speed_limit' | 'curve';
  distance_m: number;
  value_kmh?: number;     // for speed_limit
  advised_kmh?: number;   // for curve
  direction?: string;     // 'left' | 'right' | ''
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

  // Fetch OSM road geometry for the current geohash-5 sector (covers ~39km² ≈ 5km radius).
  const gh5 = encodeGeohash(lat, lon, 5);
  const roadGeometry = await getRoadGeometry(gh5, lat, lon);

  return {
    statusCode: 200,
    headers: cors,
    body: JSON.stringify({ hazards: deduped, road_geometry: roadGeometry }),
  };
};

// ── OSM Road Geometry (Overpass API, DynamoDB-cached 24h TTL) ────────────────

const GEOMETRY_CACHE_TTL_S = 24 * 60 * 60;  // 24 hours
const MU_DRY = 0.6;   // conservative lateral grip coefficient
const G      = 9.81;  // m/s²

async function getRoadGeometry(
  gh5: string,
  lat: number,
  lon: number,
): Promise<RoadGeometryAdvisory[]> {
  // 1. Try DynamoDB cache
  try {
    const cached = await dynamo.send(new GetCommand({
      TableName: GEOMETRY_TABLE,
      Key: { geohash: `geo:${gh5}`, timestamp: 'road_geometry' },
    }));
    const item = cached.Item;
    if (item && item.ttl && item.ttl > Math.floor(Date.now() / 1000)) {
      return JSON.parse(item.geometry ?? '[]') as RoadGeometryAdvisory[];
    }
  } catch (e) {
    console.warn('Geometry cache read failed:', e);
  }

  // 2. Query Overpass API
  let geometry: RoadGeometryAdvisory[] = [];
  try {
    geometry = await fetchOverpassGeometry(lat, lon);
  } catch (e) {
    console.warn('Overpass query failed (graceful degradation):', e);
    return [];   // non-fatal — app shows hazards only
  }

  // 3. Store in DynamoDB (fire-and-forget; don't block response on cache write)
  dynamo.send(new PutCommand({
    TableName: GEOMETRY_TABLE,
    Item: {
      geohash:   `geo:${gh5}`,
      timestamp: 'road_geometry',
      geometry:  JSON.stringify(geometry),
      ttl:       Math.floor(Date.now() / 1000) + GEOMETRY_CACHE_TTL_S,
    },
  })).catch(e => console.warn('Geometry cache write failed:', e));

  return geometry;
}

async function fetchOverpassGeometry(
  lat: number,
  lon: number,
): Promise<RoadGeometryAdvisory[]> {
  // Bounding box ≈ 1 km around current position
  const DELTA = 0.009;  // ~1 km at equator
  const bbox  = `${lat - DELTA},${lon - DELTA},${lat + DELTA},${lon + DELTA}`;

  // OverpassQL: fetch highway ways with maxspeed or generic highway tag
  const query = `
    [out:json][timeout:5];
    (
      way["highway"]["maxspeed"](${bbox});
      way["highway"~"^(primary|secondary|tertiary|residential|trunk)$"](${bbox});
    );
    out body geom;
  `.trim();

  const body = `data=${encodeURIComponent(query)}`;
  const rawJson = await httpPost('overpass-api.de', '/api/interpreter', body);
  const osm = JSON.parse(rawJson) as { elements: OsmWay[] };

  const advisories: RoadGeometryAdvisory[] = [];

  for (const way of osm.elements ?? []) {
    if (!way.geometry || way.geometry.length < 2) continue;

    // Distance from current position to the nearest node of this way
    const nearestNode = way.geometry.reduce((best, node) =>
      haversineMeters(lat, lon, node.lat, node.lon) <
      haversineMeters(lat, lon, best.lat, best.lon) ? node : best
    );
    const distM = haversineMeters(lat, lon, nearestNode.lat, nearestNode.lon);
    if (distM > 1200) continue;   // outside ~1km window

    // Speed limit
    const maxspeed = parseInt(way.tags?.maxspeed ?? '', 10);
    if (!isNaN(maxspeed) && maxspeed > 0) {
      advisories.push({ type: 'speed_limit', distance_m: Math.round(distM), value_kmh: maxspeed });
    }

    // Curvature — three-point circumscribed radius of consecutive node triplets
    const nodes = way.geometry;
    for (let i = 0; i < nodes.length - 2; i++) {
      const r = circumradius(nodes[i], nodes[i + 1], nodes[i + 2]);
      if (r > 0 && r < 200) {   // tight curve (< 200m radius)
        const advisedKmh = Math.round(Math.sqrt(MU_DRY * G * r) * 3.6);
        const dir = curveDirection(nodes[i], nodes[i + 1], nodes[i + 2]);
        const dNode = haversineMeters(lat, lon, nodes[i + 1].lat, nodes[i + 1].lon);
        if (dNode < 1200) {
          advisories.push({
            type:        'curve',
            distance_m:  Math.round(dNode),
            advised_kmh: Math.max(10, advisedKmh),
            direction:   dir,
          });
        }
      }
    }
  }

  // Sort by distance, deduplicate within 100m buckets
  advisories.sort((a, b) => a.distance_m - b.distance_m);
  const deduped: RoadGeometryAdvisory[] = [];
  for (const adv of advisories) {
    const bucket = Math.floor(adv.distance_m / 100);
    if (!deduped.some(a => Math.floor(a.distance_m / 100) === bucket && a.type === adv.type)) {
      deduped.push(adv);
    }
  }
  return deduped.slice(0, 10);  // max 10 advisories per scan
}

interface OsmNode { lat: number; lon: number; }
interface OsmWay  { geometry: OsmNode[]; tags?: Record<string, string>; }

/** Three-point circumscribed circle radius (metres). Returns Infinity for collinear points. */
function circumradius(a: OsmNode, b: OsmNode, c: OsmNode): number {
  const ax = a.lon, ay = a.lat;
  const bx = b.lon, by = b.lat;
  const cx = c.lon, cy = c.lat;
  const D = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(D) < 1e-12) return Infinity;
  const ux = ((ax*ax + ay*ay) * (by - cy) + (bx*bx + by*by) * (cy - ay) + (cx*cx + cy*cy) * (ay - by)) / D;
  const uy = ((ax*ax + ay*ay) * (cx - bx) + (bx*bx + by*by) * (ax - cx) + (cx*cx + cy*cy) * (bx - ax)) / D;
  // Radius in degrees → convert to metres (roughly)
  const rDeg = Math.sqrt((ax - ux)**2 + (ay - uy)**2);
  return rDeg * 111_320;  // 1° ≈ 111.32 km
}

/** Returns 'left' or 'right' based on cross-product sign of the turn at node b. */
function curveDirection(a: OsmNode, b: OsmNode, c: OsmNode): 'left' | 'right' {
  const cross = (b.lon - a.lon) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lon - a.lon);
  return cross > 0 ? 'left' : 'right';
}

function httpPost(hostname: string, path: string, body: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname, path, method: 'POST', headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
          'User-Agent': 'vigia-edge/1.0 (road-ahead lambda)',
        }},
      res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      }
    );
    req.setTimeout(6_000, () => { req.destroy(); reject(new Error('Overpass timeout')); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

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
