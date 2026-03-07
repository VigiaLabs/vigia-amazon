# Demo Data Seeding - Quick Start

## 🎯 Purpose

Populate VIGIA with **880+ realistic demo records** across all DynamoDB tables for competition judges.

## 📊 What Gets Created

| Table | Records | Description |
|-------|---------|-------------|
| **HazardsTable** | 650 | Infrastructure telemetry (potholes, debris, accidents, animals) |
| **LedgerTable** | 100 | DePIN contribution tracking with SHA-256 hash chain |
| **AgentTracesTable** | 50 | Bedrock AI reasoning logs (ReAct pattern) |
| **MaintenanceQueueTable** | 80 | Repair reports with cost estimates |
| **EconomicMetricsTable** | 50 | ROI calculations and financial analysis |

**Total**: 880 records across 10 global cities (Boston, NYC, SF, London, Paris, Tokyo, Sydney, Delhi, Bangalore, Mumbai)

## 🚀 Quick Start

### 1. Run Seeding Script
```bash
node scripts/seed-comprehensive-demo-data.js
```

**Expected Output**:
```
╔═══════════════════════════════════════════════════════════╗
║   VIGIA Comprehensive Demo Data Seeder                   ║
║   Competition-Ready Dataset for Judges                   ║
╚═══════════════════════════════════════════════════════════╝

📍 Seeding HazardsTable...
✅ Created 650 hazards across 10 cities

🔗 Seeding LedgerTable (DePIN Hash Chain)...
✅ Created 100 ledger entries with hash chain

🤖 Seeding AgentTracesTable (Bedrock Reasoning)...
✅ Created 50 agent traces with ReAct reasoning

🔧 Seeding MaintenanceQueueTable...
✅ Created 80 maintenance reports

💰 Seeding EconomicMetricsTable...
✅ Created 50 economic metrics

╔═══════════════════════════════════════════════════════════╗
║   ✅ SEEDING COMPLETE - DEMO READY!                       ║
╚═══════════════════════════════════════════════════════════╝
```

**Time**: ~2 minutes

### 2. Verify Data
```bash
# Check hazards count
aws dynamodb scan \
  --table-name VigiaStack-IngestionHazardsTable05BAEAEE-1B0GEE1NV7PU5 \
  --select COUNT \
  --region us-east-1

# Expected: { "Count": 650, "ScannedCount": 650 }
```

### 3. Test in UI
1. Open VIGIA dashboard: `npm run dev`
2. Click **Geo Explorer** → View hazards on map
3. Click **Network** → Analyze DePIN health
4. Click **Maintenance** → View repair queue
5. Click **Urban Planner** → Find optimal paths
6. Click **Console** → View agent traces

## 🌍 Geographic Coverage

**10 Cities Across 3 Continents**:
- 🇺🇸 USA: Boston, New York, San Francisco
- 🇬🇧 UK: London
- 🇫🇷 France: Paris
- 🇯🇵 Japan: Tokyo
- 🇦🇺 Australia: Sydney
- 🇮🇳 India: New Delhi, Bangalore, Mumbai

## 📈 Data Characteristics

### Hazards
- **Types**: POTHOLE (40%), DEBRIS (30%), ACCIDENT (20%), ANIMAL (10%)
- **Status**: 70% VERIFIED, 30% PENDING
- **Confidence**: 70-100% (ONNX model scores)
- **Verification**: 50-100 (Bedrock Agent scores)
- **Timeline**: Last 30 days

### Ledger
- **Hash Chain**: Valid SHA-256 chain (tamper-evident)
- **DePIN Rewards**: 10 credits per verification
- **Contributors**: 50+ unique nodes

### Agent Traces
- **Pattern**: ReAct (Reasoning + Acting)
- **Steps**: 2-4 per trace
- **Tools**: query_hazards, calculate_score, analyze_node_connectivity

### Maintenance Queue
- **Status**: 40% PENDING, 35% IN_PROGRESS, 25% COMPLETED
- **Priority**: 1-100 (agent-calculated)
- **Cost Range**: $100-$5,000 per repair

### Economic Metrics
- **ROI**: 300-500% over 10 years
- **Break-Even**: 1-3 years
- **Annual Savings**: $40,000-$80,000 per city

## 🎬 Demo Scenarios

### 1. Global Hazard Scan
**Query**: "What are the highest priority hazards globally?"

**Expected**: Top 5 hazards sorted by priority (severity + verification + confidence)

### 2. Network Health
**Action**: Click any city node → "Analyze This Node"

**Expected**: Active nodes, health score, coverage metrics

### 3. Maintenance Prioritization
**Query**: "Prioritize repairs for NYC"

**Expected**: Sorted queue with cost estimates

### 4. Urban Planning
**Query**: "Find optimal path from (42.36, -71.06) to (42.37, -71.05)"

**Expected**: Bezier curve path + ROI analysis

### 5. Agent Reasoning
**Action**: Click any verified hazard → View trace

**Expected**: Multi-step ReAct reasoning

## 💰 Cost

**Storage**: 715 KB total data  
**Seeding**: ~880 write requests (one-time)  
**Demo Queries**: ~100 read requests/day  

**Total Cost**: **$0** (within DynamoDB free tier)

## 🔧 Advanced Configuration

### Custom Table Names
```bash
export HAZARDS_TABLE_NAME="YourHazardsTable"
export LEDGER_TABLE_NAME="YourLedgerTable"
export TRACES_TABLE_NAME="YourTracesTable"
export MAINTENANCE_TABLE_NAME="YourMaintenanceTable"
export ECONOMIC_TABLE_NAME="YourEconomicTable"

node scripts/seed-comprehensive-demo-data.js
```

### Adjust Data Volume
Edit `scripts/seed-comprehensive-demo-data.js`:
```javascript
// Line 50: Hazards per city
const hazardCount = Math.floor(30 + Math.random() * 70); // 30-100 per city

// Line 120: Ledger entries
const verifiedHazards = hazards.filter(h => h.status === 'VERIFIED').slice(0, 100);

// Line 160: Agent traces
const verifiedHazards = hazards.filter(h => h.status === 'VERIFIED').slice(0, 50);
```

## 📚 Documentation

- **Full Analysis**: [docs/DATA_ECOSYSTEM.md](../docs/DATA_ECOSYSTEM.md)
- **Quick Reference**: [docs/DEMO_DATA_GUIDE.md](../docs/DEMO_DATA_GUIDE.md)
- **Architecture**: [README.md](../README.md)

## ✅ Success Criteria

- [x] 880+ records created
- [x] 10 cities across 3 continents
- [x] Valid hash chain in ledger
- [x] Realistic data distributions
- [x] All relationships valid
- [x] Queries return in <2s

## 🚀 Status

✅ **DEMO READY** - All data seeded and verified

---

**Last Updated**: 2026-03-07  
**Owner**: Lead Data Architect
