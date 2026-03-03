#!/usr/bin/env node

/**
 * Seed DynamoDB with demo hazards for VIGIA Network Intelligence
 * Creates hazards at each node location to enable agent analysis
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const crypto = require('crypto');

const client = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

// Demo nodes (matching NetworkMapView.tsx)
const DEMO_NODES = [
  { id: 'node-1', lat: 28.6139, lon: 77.2090, city: 'New Delhi', geohash: 'ttv2yzr' },
  { id: 'node-2', lat: 19.0760, lon: 72.8777, city: 'Mumbai', geohash: 'te7myzr' },
  { id: 'node-3', lat: 13.0827, lon: 80.2707, city: 'Chennai', geohash: 'tdm8yzr' },
  { id: 'node-4', lat: 22.5726, lon: 88.3639, city: 'Kolkata', geohash: 'tuvnyzr' },
  { id: 'node-5', lat: 12.9716, lon: 77.5946, city: 'Bangalore', geohash: 'tdm2yzr' },
  { id: 'node-6', lat: 17.3850, lon: 78.4867, city: 'Hyderabad', geohash: 'tep4yzr' },
  { id: 'node-7', lat: 23.0225, lon: 72.5714, city: 'Ahmedabad', geohash: 'ts7kyzr' },
  { id: 'node-8', lat: 18.5204, lon: 73.8567, city: 'Pune', geohash: 'te9myzr' },
  { id: 'node-9', lat: 26.9124, lon: 75.7873, city: 'Jaipur', geohash: 'tsv8yzr' },
  { id: 'node-10', lat: 21.1458, lon: 79.0882, city: 'Nagpur', geohash: 'tep9yzr' },
];

const HAZARD_TYPES = ['POTHOLE', 'DEBRIS', 'ACCIDENT', 'ANIMAL'];

// Generate realistic hazards for each node
async function seedHazards() {
  const tableName = process.env.HAZARDS_TABLE_NAME || 'VigiaStack-IngestionHazardsTable05BAEAEE-1B0GEE1NV7PU5';
  
  console.log(`Seeding hazards to table: ${tableName}\n`);
  
  let totalCreated = 0;
  
  for (const node of DEMO_NODES) {
    const hazardCount = Math.floor(10 + Math.random() * 20); // 10-30 hazards per node
    console.log(`Creating ${hazardCount} hazards for ${node.city}...`);
    
    for (let i = 0; i < hazardCount; i++) {
      // Random offset within ~5km of node
      const latOffset = (Math.random() - 0.5) * 0.05;
      const lonOffset = (Math.random() - 0.5) * 0.05;
      
      // Random timestamp in last 7 days
      const daysAgo = Math.floor(Math.random() * 7);
      const hoursAgo = Math.floor(Math.random() * 24);
      const timestamp = new Date(Date.now() - (daysAgo * 24 + hoursAgo) * 3600000).toISOString();
      
      const hazardType = HAZARD_TYPES[Math.floor(Math.random() * HAZARD_TYPES.length)];
      const confidence = 0.7 + Math.random() * 0.3; // 70-100%
      
      // Generate unique contributor ID (simulating different users)
      const contributorId = `contributor-${node.id}-${Math.floor(Math.random() * 5)}`;
      const signature = crypto.randomBytes(32).toString('hex');
      
      const hazard = {
        geohash: node.geohash,
        timestamp,
        hazardType,
        lat: node.lat + latOffset,
        lon: node.lon + lonOffset,
        confidence,
        status: 'VERIFIED',
        contributorId,
        signature,
        verificationScore: Math.floor(60 + Math.random() * 40), // 60-100
        sessionId: `session-${node.id}-${i}`,
        createdAt: timestamp,
      };
      
      try {
        await docClient.send(new PutCommand({
          TableName: tableName,
          Item: hazard,
        }));
        totalCreated++;
      } catch (err) {
        console.error(`Failed to create hazard:`, err.message);
      }
    }
    
    console.log(`✓ ${node.city} complete\n`);
  }
  
  console.log(`\n✅ Successfully created ${totalCreated} demo hazards across ${DEMO_NODES.length} nodes!`);
  console.log(`\nYou can now test the Network Intelligence agent:`);
  console.log(`1. Click any node on the map`);
  console.log(`2. Click "Analyze This Node"`);
  console.log(`3. Agent will analyze real data from DynamoDB\n`);
}

// Run
seedHazards().catch(console.error);
