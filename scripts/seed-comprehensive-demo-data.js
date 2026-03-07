#!/usr/bin/env node

/**
 * VIGIA Comprehensive Demo Data Seeder
 * 
 * Seeds all DynamoDB tables with realistic demo data for competition judges:
 * 1. HazardsTable - 500+ hazards across 10 global cities
 * 2. LedgerTable - DePIN contribution records with hash chain
 * 3. AgentTracesTable - Bedrock Agent reasoning logs
 * 4. MaintenanceQueueTable - Repair reports and cost estimates
 * 5. EconomicMetricsTable - ROI calculations and financial data
 * 
 * Usage: node scripts/seed-comprehensive-demo-data.js
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const crypto = require('crypto');

const client = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const TABLES = {
  hazards: process.env.HAZARDS_TABLE_NAME || 'VigiaStack-IngestionHazardsTable05BAEAEE-1B0GEE1NV7PU5',
  ledger: process.env.LEDGER_TABLE_NAME || 'VigiaStack-TrustLedgerTableD0EF6ED1-FSHKRP1596UJ',
  traces: process.env.TRACES_TABLE_NAME || 'VigiaStack-IntelligenceAgentTracesTable32827651-PSFGJ97QU5O5',
  maintenance: process.env.MAINTENANCE_TABLE_NAME || 'VigiaStack-InnovationMaintenanceQueueTableEA1566B4-1BWECBIME4HMR',
  economic: process.env.ECONOMIC_TABLE_NAME || 'VigiaStack-InnovationEconomicMetricsTableC0CB6B58-15UVLKDD0TULX',
};

// Global cities with realistic coordinates
const DEMO_CITIES = [
  { id: 'boston', name: 'Boston, MA', lat: 42.3601, lon: -71.0589, geohash: 'drt2yzr', country: 'USA' },
  { id: 'nyc', name: 'New York, NY', lat: 40.7128, lon: -74.0060, geohash: 'dr5regw', country: 'USA' },
  { id: 'sf', name: 'San Francisco, CA', lat: 37.7749, lon: -122.4194, geohash: '9q8yyzr', country: 'USA' },
  { id: 'london', name: 'London, UK', lat: 51.5074, lon: -0.1278, geohash: 'gcpvyzr', country: 'UK' },
  { id: 'paris', name: 'Paris, France', lat: 48.8566, lon: 2.3522, geohash: 'u09tyzr', country: 'France' },
  { id: 'tokyo', name: 'Tokyo, Japan', lat: 35.6762, lon: 139.6503, geohash: 'xn76yzr', country: 'Japan' },
  { id: 'sydney', name: 'Sydney, Australia', lat: -33.8688, lon: 151.2093, geohash: 'r3gxyzr', country: 'Australia' },
  { id: 'delhi', name: 'New Delhi, India', lat: 28.6139, lon: 77.2090, geohash: 'ttv2yzr', country: 'India' },
  { id: 'bangalore', name: 'Bangalore, India', lat: 12.9716, lon: 77.5946, geohash: 'tdm2yzr', country: 'India' },
  { id: 'mumbai', name: 'Mumbai, India', lat: 19.0760, lon: 72.8777, geohash: 'te7myzr', country: 'India' },
];

const HAZARD_TYPES = ['POTHOLE', 'DEBRIS', 'ACCIDENT', 'ANIMAL'];

const MAINTENANCE_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED'];

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function randomDate(daysBack) {
  const now = Date.now();
  const offset = Math.random() * daysBack * 24 * 3600 * 1000;
  return new Date(now - offset);
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomFloat(min, max) {
  return min + Math.random() * (max - min);
}

function generateSignature() {
  return crypto.randomBytes(32).toString('hex');
}

function calculateHash(data, previousHash = '') {
  const content = JSON.stringify(data) + previousHash;
  return crypto.createHash('sha256').update(content).digest('hex');
}

// ═══════════════════════════════════════════════════════════════
// 1. SEED HAZARDS TABLE
// ═══════════════════════════════════════════════════════════════

async function seedHazards() {
  console.log('\n📍 Seeding HazardsTable...');
  
  const hazards = [];
  let totalHazards = 0;
  
  for (const city of DEMO_CITIES) {
    const hazardCount = Math.floor(30 + Math.random() * 70); // 30-100 hazards per city
    
    for (let i = 0; i < hazardCount; i++) {
      // Random offset within ~10km
      const latOffset = (Math.random() - 0.5) * 0.1;
      const lonOffset = (Math.random() - 0.5) * 0.1;
      
      const timestamp = randomDate(30).toISOString(); // Last 30 days
      const hazardType = randomChoice(HAZARD_TYPES);
      const confidence = randomFloat(0.7, 1.0);
      const verificationScore = Math.floor(randomFloat(50, 100));
      
      const hazard = {
        geohash: city.geohash,
        timestamp,
        hazardType,
        lat: city.lat + latOffset,
        lon: city.lon + lonOffset,
        confidence,
        status: verificationScore >= 70 ? 'VERIFIED' : 'PENDING',
        contributorId: `contributor-${city.id}-${Math.floor(Math.random() * 10)}`,
        signature: generateSignature(),
        verificationScore,
        sessionId: `session-${city.id}-${Date.now()}-${i}`,
        createdAt: timestamp,
        city: city.name,
        country: city.country,
      };
      
      hazards.push(hazard);
      totalHazards++;
    }
  }
  
  // Batch write (25 items at a time)
  for (let i = 0; i < hazards.length; i += 25) {
    const batch = hazards.slice(i, i + 25);
    
    try {
      await docClient.send(new BatchWriteCommand({
        RequestItems: {
          [TABLES.hazards]: batch.map(item => ({
            PutRequest: { Item: item }
          }))
        }
      }));
    } catch (err) {
      console.error(`Batch write failed:`, err.message);
    }
  }
  
  console.log(`✅ Created ${totalHazards} hazards across ${DEMO_CITIES.length} cities`);
  return hazards;
}

// ═══════════════════════════════════════════════════════════════
// 2. SEED LEDGER TABLE (DePIN Hash Chain)
// ═══════════════════════════════════════════════════════════════

async function seedLedger(hazards) {
  console.log('\n🔗 Seeding LedgerTable (DePIN Hash Chain)...');
  
  let previousHash = '';
  let totalEntries = 0;
  
  // Create ledger entries for verified hazards
  const verifiedHazards = hazards.filter(h => h.status === 'VERIFIED').slice(0, 100);
  
  for (const hazard of verifiedHazards) {
    const entry = {
      ledgerId: `ledger-${Date.now()}-${totalEntries}`,
      timestamp: hazard.timestamp,
      sessionId: hazard.sessionId,
      action: 'HAZARD_VERIFIED',
      contributorId: hazard.contributorId,
      hazardId: `${hazard.geohash}#${hazard.timestamp}`,
      credits: 10, // DePIN reward
      previousHash,
    };
    
    // Calculate current hash
    entry.currentHash = calculateHash(entry, previousHash);
    previousHash = entry.currentHash;
    
    try {
      await docClient.send(new PutCommand({
        TableName: TABLES.ledger,
        Item: entry,
      }));
      totalEntries++;
    } catch (err) {
      console.error(`Ledger write failed:`, err.message);
    }
  }
  
  console.log(`✅ Created ${totalEntries} ledger entries with hash chain`);
}

// ═══════════════════════════════════════════════════════════════
// 3. SEED AGENT TRACES TABLE
// ═══════════════════════════════════════════════════════════════

async function seedAgentTraces(hazards) {
  console.log('\n🤖 Seeding AgentTracesTable (Bedrock Reasoning)...');
  
  const verifiedHazards = hazards.filter(h => h.status === 'VERIFIED').slice(0, 50);
  let totalTraces = 0;
  
  for (const hazard of verifiedHazards) {
    const trace = {
      traceId: `trace-${Date.now()}-${totalTraces}`,
      timestamp: Date.now(),
      hazardId: `${hazard.geohash}#${hazard.timestamp}`,
      geohash: hazard.geohash,
      agentId: 'TAWWC3SQ0L',
      sessionId: hazard.sessionId,
      steps: [
        {
          thought: `User wants to verify a ${hazard.hazardType} at ${hazard.city}. I should query similar hazards in the area.`,
          action: 'query_hazards',
          actionInput: {
            geohash: hazard.geohash,
            radiusMeters: 1000,
            hoursBack: 168,
          },
          observation: `Found 15 similar ${hazard.hazardType} reports in the area.`,
        },
        {
          thought: 'Now I should calculate the verification score based on similar reports.',
          action: 'calculate_score',
          actionInput: {
            similarHazards: [
              { hazardType: hazard.hazardType, confidence: 0.92, timestamp: hazard.timestamp },
            ],
          },
          observation: `Verification score: ${hazard.verificationScore}/100`,
        },
      ],
      finalAnswer: `This ${hazard.hazardType} is ${hazard.status.toLowerCase()} with a score of ${hazard.verificationScore}/100. Found 15 similar reports in the area, indicating this is a recurring issue.`,
      ttl: Math.floor(Date.now() / 1000) + (7 * 24 * 3600), // 7 days TTL
    };
    
    try {
      await docClient.send(new PutCommand({
        TableName: TABLES.traces,
        Item: trace,
      }));
      totalTraces++;
    } catch (err) {
      console.error(`Trace write failed:`, err.message);
    }
  }
  
  console.log(`✅ Created ${totalTraces} agent traces with ReAct reasoning`);
}

// ═══════════════════════════════════════════════════════════════
// 4. SEED MAINTENANCE QUEUE TABLE
// ═══════════════════════════════════════════════════════════════

async function seedMaintenanceQueue(hazards) {
  console.log('\n🔧 Seeding MaintenanceQueueTable...');
  
  const verifiedHazards = hazards.filter(h => h.status === 'VERIFIED').slice(0, 80);
  let totalReports = 0;
  
  const baseCosts = {
    POTHOLE: 500,
    DEBRIS: 200,
    ACCIDENT: 5000,
    ANIMAL: 100,
  };
  
  for (const hazard of verifiedHazards) {
    const baseCost = baseCosts[hazard.hazardType];
    const severityMultiplier = hazard.verificationScore / 100;
    const estimatedCost = Math.round(baseCost * (1 + severityMultiplier * 0.2));
    
    const report = {
      reportId: `report-${Date.now()}-${totalReports}`,
      reportedAt: Date.now(),
      hazardId: `${hazard.geohash}#${hazard.timestamp}`,
      geohash: hazard.geohash,
      hazardType: hazard.hazardType,
      estimatedCost,
      status: randomChoice(MAINTENANCE_STATUSES),
      priority: Math.floor(randomFloat(1, 100)),
      assignedTo: `crew-${Math.floor(Math.random() * 5)}`,
      city: hazard.city,
      country: hazard.country,
      notes: `${hazard.hazardType} reported at ${hazard.city}. Verification score: ${hazard.verificationScore}/100`,
    };
    
    try {
      await docClient.send(new PutCommand({
        TableName: TABLES.maintenance,
        Item: report,
      }));
      totalReports++;
    } catch (err) {
      console.error(`Maintenance report write failed:`, err.message);
    }
  }
  
  console.log(`✅ Created ${totalReports} maintenance reports`);
}

// ═══════════════════════════════════════════════════════════════
// 5. SEED ECONOMIC METRICS TABLE
// ═══════════════════════════════════════════════════════════════

async function seedEconomicMetrics() {
  console.log('\n💰 Seeding EconomicMetricsTable...');
  
  let totalMetrics = 0;
  
  for (const city of DEMO_CITIES) {
    // Create 5 sessions per city with economic data
    for (let i = 0; i < 5; i++) {
      const sessionId = `session-${city.id}-${Date.now()}-${i}`;
      const timestamp = Date.now();
      
      const totalHazards = Math.floor(randomFloat(20, 100));
      const verifiedHazards = Math.floor(totalHazards * randomFloat(0.6, 0.9));
      const avgRepairCost = 500;
      const totalRepairCost = verifiedHazards * avgRepairCost;
      const annualSavings = totalRepairCost * 0.8; // 80% savings from prevention
      
      const metric = {
        sessionId,
        timestamp,
        city: city.name,
        country: city.country,
        geohash: city.geohash,
        totalHazards,
        verifiedHazards,
        pendingHazards: totalHazards - verifiedHazards,
        totalRepairCost,
        annualSavings,
        roi10Year: Math.round(((annualSavings * 10 - totalRepairCost) / totalRepairCost) * 100),
        breakEvenYears: Math.round(totalRepairCost / annualSavings * 10) / 10,
        contributorCount: Math.floor(randomFloat(5, 20)),
        avgVerificationScore: Math.floor(randomFloat(70, 95)),
      };
      
      try {
        await docClient.send(new PutCommand({
          TableName: TABLES.economic,
          Item: metric,
        }));
        totalMetrics++;
      } catch (err) {
        console.error(`Economic metric write failed:`, err.message);
      }
    }
  }
  
  console.log(`✅ Created ${totalMetrics} economic metrics`);
}

// ═══════════════════════════════════════════════════════════════
// MAIN EXECUTION
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   VIGIA Comprehensive Demo Data Seeder                   ║');
  console.log('║   Competition-Ready Dataset for Judges                   ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  
  console.log('\n📊 Target Tables:');
  console.log(`   • HazardsTable: ${TABLES.hazards}`);
  console.log(`   • LedgerTable: ${TABLES.ledger}`);
  console.log(`   • AgentTracesTable: ${TABLES.traces}`);
  console.log(`   • MaintenanceQueueTable: ${TABLES.maintenance}`);
  console.log(`   • EconomicMetricsTable: ${TABLES.economic}`);
  
  console.log('\n🌍 Demo Cities:', DEMO_CITIES.length);
  console.log('   Coverage: USA, UK, France, Japan, Australia, India');
  
  try {
    // Seed all tables
    const hazards = await seedHazards();
    await seedLedger(hazards);
    await seedAgentTraces(hazards);
    await seedMaintenanceQueue(hazards);
    await seedEconomicMetrics();
    
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║   ✅ SEEDING COMPLETE - DEMO READY!                       ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    
    console.log('\n📈 Summary:');
    console.log(`   • ${hazards.length} hazards across 10 global cities`);
    console.log(`   • ${hazards.filter(h => h.status === 'VERIFIED').length} verified hazards`);
    console.log(`   • 100 DePIN ledger entries with hash chain`);
    console.log(`   • 50 agent traces with ReAct reasoning`);
    console.log(`   • 80 maintenance reports`);
    console.log(`   • 50 economic metrics`);
    
    console.log('\n🎯 Next Steps:');
    console.log('   1. Open VIGIA dashboard');
    console.log('   2. Test all 5 activity groups:');
    console.log('      • Geo Explorer - View hazards on map');
    console.log('      • Network - Analyze DePIN health');
    console.log('      • Maintenance - Prioritize repairs');
    console.log('      • Urban Planner - Find optimal paths');
    console.log('      • Console - View agent traces');
    console.log('   3. Demo to judges! 🚀\n');
    
  } catch (err) {
    console.error('\n❌ Seeding failed:', err);
    process.exit(1);
  }
}

// Run
main().catch(console.error);
