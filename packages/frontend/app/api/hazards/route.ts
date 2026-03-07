import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

const HAZARDS_TABLE = 'VigiaStack-IngestionHazardsTable05BAEAEE-1B0GEE1NV7PU5';

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = parseFloat(searchParams.get('lat') || '0');
    const lon = parseFloat(searchParams.get('lon') || '0');
    const radius = parseInt(searchParams.get('radius') || '50000'); // 50km default

    // Scan hazards table
    const result = await docClient.send(new ScanCommand({
      TableName: HAZARDS_TABLE,
      Limit: 500,
    }));

    const hazards = (result.Items || [])
      .filter(h => {
        const distance = calculateDistance(lat, lon, h.lat, h.lon);
        return distance <= radius;
      })
      .map(h => ({
        lat: h.lat,
        lon: h.lon,
        hazardType: h.hazardType,
        status: h.status,
        confidence: h.confidence,
        timestamp: h.timestamp,
      }));

    return NextResponse.json({ hazards });
  } catch (error) {
    console.error('Failed to fetch hazards:', error);
    return NextResponse.json({ error: 'Failed to fetch hazards', hazards: [] }, { status: 500 });
  }
}
