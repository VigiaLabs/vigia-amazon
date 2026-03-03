import ngeohash from 'ngeohash';
import type { MapFile, LegacyMapFile, Hazard } from './mapFile';

/**
 * Calculate bounding box from hazards
 */
function calculateBoundingBox(hazards: Hazard[]) {
  if (hazards.length === 0) {
    return { north: 0, south: 0, east: 0, west: 0 };
  }

  const lats = hazards.map(h => h.lat);
  const lons = hazards.map(h => h.lon);

  return {
    north: Math.max(...lats),
    south: Math.min(...lats),
    east: Math.max(...lons),
    west: Math.min(...lons),
  };
}

/**
 * Calculate center point from bounding box
 */
function calculateCenterPoint(boundingBox: { north: number; south: number; east: number; west: number }) {
  const lat = (boundingBox.north + boundingBox.south) / 2;
  const lon = (boundingBox.east + boundingBox.west) / 2;
  return { lat, lon, geohash: ngeohash.encode(lat, lon, 7) };
}

/**
 * Calculate area in km² using Haversine formula
 */
function calculateArea(boundingBox: { north: number; south: number; east: number; west: number }): number {
  const R = 6371; // Earth radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const latDiff = toRad(boundingBox.north - boundingBox.south);
  const lonDiff = toRad(boundingBox.east - boundingBox.west);
  const avgLat = toRad((boundingBox.north + boundingBox.south) / 2);

  const height = latDiff * R;
  const width = lonDiff * R * Math.cos(avgLat);

  return Math.abs(height * width);
}

/**
 * Determine adaptive geohash precision based on area
 */
function determineGeohashPrecision(areaKm2: number): number {
  if (areaKm2 > 1000) return 5;      // Large region (>1000 km²)
  if (areaKm2 > 100) return 6;       // City (~100-1000 km²)
  if (areaKm2 > 10) return 7;        // Neighborhood (~10-100 km²)
  if (areaKm2 > 1) return 8;         // Street (~1-10 km²)
  return 9;                          // Building (<1 km²)
}

/**
 * Generate geohash tiles covering bounding box
 */
function generateGeohashTiles(
  boundingBox: { north: number; south: number; east: number; west: number },
  precision: number
): string[] {
  const tiles = new Set<string>();
  
  // Geohash cell sizes (approximate)
  const cellSizes: Record<number, { lat: number; lon: number }> = {
    5: { lat: 0.02197, lon: 0.02197 },
    6: { lat: 0.00549, lon: 0.00549 },
    7: { lat: 0.00137, lon: 0.00137 },
    8: { lat: 0.00034, lon: 0.00034 },
    9: { lat: 0.000086, lon: 0.000086 },
  };

  const cellSize = cellSizes[precision] || cellSizes[7];
  
  for (let lat = boundingBox.south; lat <= boundingBox.north; lat += cellSize.lat) {
    for (let lon = boundingBox.west; lon <= boundingBox.east; lon += cellSize.lon) {
      tiles.add(ngeohash.encode(lat, lon, precision));
    }
  }

  return Array.from(tiles);
}

/**
 * Parse location from sessionId or hazard data
 */
function parseLocation(sessionId: string, hazards: Hazard[]): {
  continent: string;
  country: string;
  state: string;
  region: string;
  city: string;
} {
  // Default fallback location
  return {
    continent: 'Unknown',
    country: 'Unknown',
    state: 'Unknown',
    region: 'Unknown',
    city: sessionId.split('#')[0] || 'Unknown',
  };
}

/**
 * Generate display name from location and timestamp
 */
function generateDisplayName(city: string, timestamp: number): string {
  const date = new Date(timestamp).toISOString().split('T')[0];
  return `${city}-${date}-001`;
}

/**
 * Calculate hazard statistics
 */
function calculateHazardStats(hazards: Hazard[]) {
  const hazardsByType: Record<string, number> = {};
  const severityDistribution: Record<string, number> = {};

  for (const hazard of hazards) {
    hazardsByType[hazard.type] = (hazardsByType[hazard.type] || 0) + 1;
    severityDistribution[String(hazard.severity)] = (severityDistribution[String(hazard.severity)] || 0) + 1;
  }

  return { hazardsByType, severityDistribution };
}

/**
 * Migrate legacy MapFile to new schema
 */
export function migrateLegacyMapFile(legacy: LegacyMapFile): MapFile {
  const boundingBox = calculateBoundingBox(legacy.hazards);
  const centerPoint = calculateCenterPoint(boundingBox);
  const areaKm2 = calculateArea(boundingBox);
  const geohashPrecision = determineGeohashPrecision(areaKm2);
  const geohashTiles = generateGeohashTiles(boundingBox, geohashPrecision);
  const location = parseLocation(legacy.sessionId, legacy.hazards);
  const displayName = generateDisplayName(location.city, legacy.timestamp);
  const { hazardsByType, severityDistribution } = calculateHazardStats(legacy.hazards);

  const captureStart = legacy.hazards.length > 0
    ? Math.min(...legacy.hazards.map(h => h.timestamp))
    : legacy.timestamp;
  const captureEnd = legacy.hazards.length > 0
    ? Math.max(...legacy.hazards.map(h => h.timestamp))
    : legacy.timestamp;

  return {
    version: '1.0',
    sessionId: legacy.sessionId,
    displayName,
    coverage: {
      type: areaKm2 > 100 ? 'city' : areaKm2 > 10 ? 'neighborhood' : 'custom',
      name: `${location.city}, ${location.region}, ${location.country}`,
      boundingBox,
      centerPoint,
      geohashPrecision,
      geohashTiles,
      areaKm2,
    },
    temporal: {
      captureStart,
      captureEnd,
      createdAt: legacy.timestamp,
      duration: captureEnd - captureStart,
      status: 'finalized',
    },
    location,
    hazards: legacy.hazards,
    metadata: {
      totalHazards: legacy.metadata.totalHazards,
      hazardsByType,
      severityDistribution,
      contributors: legacy.metadata.contributors,
      dataSource: 'import',
      tags: [],
    },
  };
}

/**
 * Check if MapFile is legacy format
 */
export function isLegacyMapFile(file: any): file is LegacyMapFile {
  return (
    file.version === '1.0' &&
    typeof file.timestamp === 'number' &&
    !file.coverage &&
    !file.temporal
  );
}
