const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, BatchWriteCommand, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

const HAZARDS_TABLE = 'VigiaStack-IngestionHazardsTable05BAEAEE-1B0GEE1NV7PU5';

// Major road networks for each city with actual road coordinates
const CITY_ROADS = {
  'Boston': {
    center: { lat: 42.3601, lon: -71.0589 },
    roads: [
      // I-93 (North-South)
      { name: 'I-93', points: [[42.3501, -71.0589], [42.3601, -71.0589], [42.3701, -71.0589]] },
      // I-90 (Mass Pike, East-West)
      { name: 'I-90', points: [[42.3501, -71.0789], [42.3501, -71.0589], [42.3501, -71.0389]] },
      // Storrow Drive
      { name: 'Storrow Dr', points: [[42.3601, -71.0789], [42.3601, -71.0689], [42.3601, -71.0589], [42.3601, -71.0489]] },
      // Commonwealth Ave
      { name: 'Commonwealth Ave', points: [[42.3501, -71.0889], [42.3501, -71.0689], [42.3501, -71.0489]] },
    ]
  },
  'New York': {
    center: { lat: 40.7128, lon: -74.0060 },
    roads: [
      // FDR Drive
      { name: 'FDR Drive', points: [[40.7028, -73.9960], [40.7128, -73.9960], [40.7228, -73.9960]] },
      // West Side Highway
      { name: 'West Side Hwy', points: [[40.7028, -74.0160], [40.7128, -74.0160], [40.7228, -74.0160]] },
      // Broadway
      { name: 'Broadway', points: [[40.7028, -74.0060], [40.7128, -74.0060], [40.7228, -74.0060]] },
      // 5th Avenue
      { name: '5th Ave', points: [[40.7028, -73.9860], [40.7128, -73.9860], [40.7228, -73.9860]] },
    ]
  },
  'Los Angeles': {
    center: { lat: 34.0522, lon: -118.2437 },
    roads: [
      // I-405
      { name: 'I-405', points: [[34.0422, -118.2537], [34.0522, -118.2537], [34.0622, -118.2537]] },
      // I-10
      { name: 'I-10', points: [[34.0422, -118.2637], [34.0422, -118.2437], [34.0422, -118.2237]] },
      // Santa Monica Blvd
      { name: 'Santa Monica Blvd', points: [[34.0522, -118.2737], [34.0522, -118.2537], [34.0522, -118.2337]] },
      // Sunset Blvd
      { name: 'Sunset Blvd', points: [[34.0622, -118.2737], [34.0622, -118.2537], [34.0622, -118.2337]] },
    ]
  },
};

// Generate geohash (precision 7)
function encodeGeohash(lat, lon, precision = 7) {
  const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let idx = 0;
  let bit = 0;
  let evenBit = true;
  let geohash = '';
  let latMin = -90, latMax = 90;
  let lonMin = -180, lonMax = 180;

  while (geohash.length < precision) {
    if (evenBit) {
      const lonMid = (lonMin + lonMax) / 2;
      if (lon > lonMid) {
        idx = (idx << 1) + 1;
        lonMin = lonMid;
      } else {
        idx = idx << 1;
        lonMax = lonMid;
      }
    } else {
      const latMid = (latMin + latMax) / 2;
      if (lat > latMid) {
        idx = (idx << 1) + 1;
        latMin = latMid;
      } else {
        idx = idx << 1;
        latMax = latMid;
      }
    }
    evenBit = !evenBit;

    if (++bit === 5) {
      geohash += BASE32[idx];
      bit = 0;
      idx = 0;
    }
  }
  return geohash;
}

// Interpolate points along a road segment
function interpolateRoad(start, end, numPoints) {
  const points = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const lat = start[0] + t * (end[0] - start[0]);
    const lon = start[1] + t * (end[1] - start[1]);
    points.push([lat, lon]);
  }
  return points;
}

// Generate hazards along roads
function generateRoadHazards(cityName, cityData) {
  const hazards = [];
  const hazardTypes = ['POTHOLE', 'DEBRIS', 'POTHOLE', 'POTHOLE']; // More potholes
  const now = Date.now();
  
  cityData.roads.forEach(road => {
    // For each road segment
    for (let i = 0; i < road.points.length - 1; i++) {
      const start = road.points[i];
      const end = road.points[i + 1];
      
      // Generate 5-10 hazards per segment
      const numHazards = 5 + Math.floor(Math.random() * 6);
      const roadPoints = interpolateRoad(start, end, numHazards);
      
      roadPoints.forEach((point, idx) => {
        // Add small random offset (±10m) to simulate exact hazard location
        const lat = point[0] + (Math.random() - 0.5) * 0.0001;
        const lon = point[1] + (Math.random() - 0.5) * 0.0001;
        
        const hazardType = hazardTypes[Math.floor(Math.random() * hazardTypes.length)];
        const confidence = 0.7 + Math.random() * 0.3;
        const daysAgo = Math.floor(Math.random() * 30); // Last 30 days
        const timestamp = new Date(now - daysAgo * 24 * 60 * 60 * 1000 + idx * 1000).toISOString(); // Add seconds offset
        
        hazards.push({
          geohash: encodeGeohash(lat, lon),
          timestamp,
          hazardType,
          lat,
          lon,
          confidence,
          status: Math.random() > 0.2 ? 'verified' : 'pending', // 80% verified
          verificationScore: Math.floor(60 + Math.random() * 40),
          contributorId: `node-${cityName.toLowerCase()}-${Math.floor(Math.random() * 10)}`,
          sessionId: `session-${cityName.toLowerCase()}-${Date.now()}`,
          signature: `sig-${Math.random().toString(36).substring(7)}`,
          createdAt: timestamp,
          roadName: road.name,
        });
      });
    }
  });
  
  return hazards;
}

// Clear existing hazards
async function clearHazards() {
  console.log('Clearing existing hazards...');
  
  let lastEvaluatedKey = undefined;
  let totalDeleted = 0;
  
  do {
    const scanResult = await docClient.send(new ScanCommand({
      TableName: HAZARDS_TABLE,
      Limit: 25,
      ExclusiveStartKey: lastEvaluatedKey,
    }));
    
    if (scanResult.Items && scanResult.Items.length > 0) {
      // Delete in batches of 25
      const deleteRequests = scanResult.Items.map(item => ({
        DeleteRequest: {
          Key: {
            geohash: item.geohash,
            timestamp: item.timestamp,
          }
        }
      }));
      
      await docClient.send(new BatchWriteCommand({
        RequestItems: {
          [HAZARDS_TABLE]: deleteRequests
        }
      }));
      
      totalDeleted += deleteRequests.length;
      console.log(`Deleted ${totalDeleted} hazards...`);
    }
    
    lastEvaluatedKey = scanResult.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  
  console.log(`✓ Cleared ${totalDeleted} existing hazards`);
}

// Seed hazards
async function seedHazards() {
  console.log('Generating road-based hazards...');
  
  const allHazards = [];
  
  for (const [cityName, cityData] of Object.entries(CITY_ROADS)) {
    const cityHazards = generateRoadHazards(cityName, cityData);
    allHazards.push(...cityHazards);
    console.log(`Generated ${cityHazards.length} hazards for ${cityName}`);
  }
  
  console.log(`\nTotal hazards to seed: ${allHazards.length}`);
  console.log('Writing to DynamoDB...');
  
  // Write in batches of 25
  for (let i = 0; i < allHazards.length; i += 25) {
    const batch = allHazards.slice(i, i + 25);
    
    await docClient.send(new BatchWriteCommand({
      RequestItems: {
        [HAZARDS_TABLE]: batch.map(hazard => ({
          PutRequest: { Item: hazard }
        }))
      }
    }));
    
    console.log(`Written ${Math.min(i + 25, allHazards.length)}/${allHazards.length} hazards`);
  }
  
  console.log('\n✓ All hazards seeded successfully!');
  
  // Print summary by city
  console.log('\n=== Summary by City ===');
  for (const cityName of Object.keys(CITY_ROADS)) {
    const cityHazards = allHazards.filter(h => h.contributorId.includes(cityName.toLowerCase()));
    const potholes = cityHazards.filter(h => h.hazardType === 'POTHOLE').length;
    const debris = cityHazards.filter(h => h.hazardType === 'DEBRIS').length;
    console.log(`${cityName}: ${cityHazards.length} total (${potholes} potholes, ${debris} debris)`);
  }
}

async function main() {
  try {
    await clearHazards();
    await seedHazards();
    console.log('\n✅ Road-based hazard seeding complete!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
