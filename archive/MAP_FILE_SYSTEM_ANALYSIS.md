# Map File System: Temporal-Geographical Storage Analysis

**Date**: March 3, 2026  
**Purpose**: Analyze current implementation and propose optimal system for temporal-geographical snapshots

---

## Current Implementation Analysis

### 1. Data Structure

#### MapFile Schema (packages/shared/src/mapFile.ts)
```typescript
{
  version: "1.0",
  sessionId: string,           // Currently: "{geohash7}#{timestamp}"
  timestamp: number,            // Unix epoch
  hazards: Hazard[],
  metadata: {
    totalHazards: number,
    geohashBounds: string[],   // Array of geohash strings
    contributors: string[]
  }
}
```

#### Hazard Schema
```typescript
{
  id: string (UUID),
  geohash: string (7 chars),   // Precision 7 (~153m x 153m)
  lat: number,
  lon: number,
  type: 'POTHOLE' | 'DEBRIS' | 'FLOODING' | 'ACCIDENT',
  severity: 1-5,
  timestamp: number,
  signature: string,
  contributorId: string,
  frameHash?: string
}
```

### 2. Storage Mechanism

**Location**: IndexedDB (browser-local)
- **Database**: `VigiaMapFiles`
- **Stores**: 
  - `mapFiles` (keyPath: `sessionId`)
  - `branches` (keyPath: `branchId`)
- **Indexes**:
  - `timestamp` (for temporal queries)
  - `parentMapId` (for branch relationships)

**Quota Management**:
- Max 20 files
- Max 50 MB total
- LRU eviction when limits exceeded

### 3. Session Creation Flow

**Current Process** (NewSessionView.tsx):
1. User searches for location (Amazon Location Service)
2. User selects location → gets lat/lon + place details
3. System generates:
   - `geohash7`: Random 7-char geohash (NOT derived from actual location)
   - `sessionId`: `"{geohash7}#{timestamp}"`
   - `location`: `{ continent, country, region, city }`
4. Session stored in DynamoDB via API
5. Hazards added to session over time

---

## Problems with Current Implementation

### 1. **Geographical Scope is Unclear**
- ❌ `sessionId` uses random geohash, not actual coverage area
- ❌ `geohashBounds` is an array but not properly populated
- ❌ No clear definition of what area a session covers
- ❌ Can't determine if two sessions overlap geographically

### 2. **Temporal Information is Weak**
- ❌ Only single timestamp (session creation time)
- ❌ No start/end time for data collection period
- ❌ No way to know if session is "complete" or still collecting data
- ❌ Can't query "all sessions for area X between dates Y and Z"

### 3. **Naming Convention is Inconsistent**
- ❌ SessionId format: `"{geohash}#{timestamp}"` (not human-readable)
- ❌ No standardized naming like `"Session-2026-03-01.map"`
- ❌ No way to identify sessions by location name

### 4. **No Hierarchical Organization**
- ❌ All sessions are flat (no folders by region/time)
- ❌ Can't group sessions by city, state, or time period
- ❌ Difficult to find related sessions

### 5. **Geohash Precision Issues**
- ❌ Precision 7 (~153m x 153m) may be too coarse for city-level analysis
- ❌ No support for variable precision (city vs neighborhood vs street)

---

## Optimal Implementation Proposal

### 1. Enhanced MapFile Schema

```typescript
interface MapFile {
  version: "1.0",
  
  // Identity
  sessionId: string,              // UUID (stable identifier)
  displayName: string,            // "Rourkela-2026-03-01"
  
  // Geographical Scope
  coverage: {
    type: "city" | "region" | "neighborhood" | "custom",
    name: string,                 // "Rourkela, Odisha, India"
    boundingBox: {
      north: number,
      south: number,
      east: number,
      west: number
    },
    centerPoint: {
      lat: number,
      lon: number,
      geohash: string             // Derived from center
    },
    geohashPrecision: number,     // 5-9 (adaptive based on area size)
    geohashTiles: string[],       // All geohashes covering the area
    areaKm2: number               // Computed area
  },
  
  // Temporal Scope
  temporal: {
    captureStart: number,         // Unix epoch (first hazard timestamp)
    captureEnd: number,           // Unix epoch (last hazard timestamp)
    createdAt: number,            // Session creation time
    finalizedAt?: number,         // When session was marked complete
    duration: number,             // captureEnd - captureStart (seconds)
    status: "collecting" | "finalized" | "archived"
  },
  
  // Hierarchical Location
  location: {
    continent: string,
    country: string,
    state: string,                // NEW: state/province level
    region: string,               // District/county
    city: string,
    neighborhood?: string         // Optional sub-city level
  },
  
  // Data
  hazards: Hazard[],
  
  // Metadata
  metadata: {
    totalHazards: number,
    hazardsByType: Record<HazardType, number>,
    severityDistribution: Record<1|2|3|4|5, number>,
    contributors: string[],
    dataSource: "manual" | "video" | "import",
    tags: string[]                // User-defined tags
  }
}
```

### 2. Naming Convention

**Format**: `{Location}-{Date}-{Sequence}.map`

**Examples**:
- `Rourkela-2026-03-01-001.map`
- `Rourkela-2026-03-15-001.map`
- `Odisha-2026-Q1-001.map` (regional aggregate)
- `India-2026-Annual-001.map` (national aggregate)

**Rules**:
- Location: City name (or region for larger areas)
- Date: ISO date (YYYY-MM-DD) or period (Q1, Annual)
- Sequence: 3-digit number for multiple sessions same day
- Extension: `.map` for real data, `.scmap` for simulations

### 3. Hierarchical Storage Structure

```
IndexedDB Structure:
├── mapFiles (store)
│   ├── sessionId (PK)
│   ├── Indexes:
│   │   ├── location.country
│   │   ├── location.state
│   │   ├── location.city
│   │   ├── temporal.captureStart
│   │   ├── temporal.captureEnd
│   │   ├── coverage.type
│   │   └── temporal.status
```

**UI Folder Structure** (virtual, computed from metadata):
```
📁 India
  📁 Odisha
    📁 Rourkela
      📄 Rourkela-2026-01-15-001.map
      📄 Rourkela-2026-02-20-001.map
      📄 Rourkela-2026-03-01-001.map
      🌿 Rourkela-2026-03-01-branch-flood.scmap
    📁 Bhubaneswar
      📄 Bhubaneswar-2026-01-10-001.map
```

### 4. Geohash Strategy

**Adaptive Precision**:
- City-level: Precision 5 (~4.9km x 4.9km)
- Neighborhood: Precision 6 (~1.2km x 0.6km)
- Street-level: Precision 7 (~153m x 153m)
- Building-level: Precision 8 (~38m x 19m)

**Coverage Calculation**:
```typescript
function calculateGeohashTiles(boundingBox: BoundingBox, precision: number): string[] {
  const tiles: string[] = [];
  const latStep = getGeohashLatStep(precision);
  const lonStep = getGeohashLonStep(precision);
  
  for (let lat = boundingBox.south; lat <= boundingBox.north; lat += latStep) {
    for (let lon = boundingBox.west; lon <= boundingBox.east; lon += lonStep) {
      tiles.push(ngeohash.encode(lat, lon, precision));
    }
  }
  
  return [...new Set(tiles)]; // Remove duplicates
}
```

### 5. Session Creation Workflow

**Step 1: Define Coverage Area**
```typescript
// User draws bounding box on map OR selects city from search
const coverage = {
  type: "city",
  name: "Rourkela, Odisha, India",
  boundingBox: {
    north: 22.2804,
    south: 22.2004,
    east: 84.9104,
    west: 84.8304
  },
  centerPoint: {
    lat: 22.2404,
    lon: 84.8704,
    geohash: ngeohash.encode(22.2404, 84.8704, 7)
  },
  geohashPrecision: 6, // Auto-calculated based on area size
  geohashTiles: calculateGeohashTiles(boundingBox, 6),
  areaKm2: calculateArea(boundingBox)
};
```

**Step 2: Initialize Session**
```typescript
const session: MapFile = {
  version: "1.0",
  sessionId: uuidv4(),
  displayName: `Rourkela-${new Date().toISOString().split('T')[0]}-001`,
  coverage,
  temporal: {
    captureStart: Date.now(),
    captureEnd: Date.now(),
    createdAt: Date.now(),
    duration: 0,
    status: "collecting"
  },
  location: {
    continent: "Asia",
    country: "India",
    state: "Odisha",
    region: "Sundargarh",
    city: "Rourkela"
  },
  hazards: [],
  metadata: {
    totalHazards: 0,
    hazardsByType: {},
    severityDistribution: {},
    contributors: [],
    dataSource: "manual",
    tags: []
  }
};
```

**Step 3: Collect Data**
- User uploads videos or manually adds hazards
- Each hazard's geohash is checked against `coverage.geohashTiles`
- Only hazards within coverage area are added
- `temporal.captureEnd` updated with each new hazard

**Step 4: Finalize Session**
```typescript
session.temporal.status = "finalized";
session.temporal.finalizedAt = Date.now();
session.temporal.duration = session.temporal.captureEnd - session.temporal.captureStart;
```

### 6. Querying Sessions

**By Location**:
```typescript
// Get all sessions for a city
const sessions = await db.getAllFromIndex('mapFiles', 'location.city', 'Rourkela');

// Get all sessions for a state
const sessions = await db.getAllFromIndex('mapFiles', 'location.state', 'Odisha');
```

**By Time Period**:
```typescript
// Get sessions captured in March 2026
const marchStart = new Date('2026-03-01').getTime();
const marchEnd = new Date('2026-04-01').getTime();

const sessions = await db.getAllFromIndex('mapFiles', 'temporal.captureStart')
  .then(all => all.filter(s => 
    s.temporal.captureStart >= marchStart && 
    s.temporal.captureStart < marchEnd
  ));
```

**By Geographical Overlap**:
```typescript
// Find sessions that overlap with a specific area
function findOverlappingSessions(targetBox: BoundingBox): MapFile[] {
  return allSessions.filter(session => {
    const box = session.coverage.boundingBox;
    return !(
      box.north < targetBox.south ||
      box.south > targetBox.north ||
      box.east < targetBox.west ||
      box.west > targetBox.east
    );
  });
}
```

### 7. Temporal Analysis Features

**Infrastructure Decay Tracking**:
```typescript
// Compare same area across time
const sessions = await getSessionsForCity('Rourkela');
const sortedByTime = sessions.sort((a, b) => 
  a.temporal.captureStart - b.temporal.captureStart
);

// Compute diff between consecutive sessions
for (let i = 1; i < sortedByTime.length; i++) {
  const diff = computeDiff(sortedByTime[i-1], sortedByTime[i]);
  console.log(`${sortedByTime[i].displayName}: +${diff.summary.totalNew} new, -${diff.summary.totalFixed} fixed`);
}
```

**Hotspot Identification**:
```typescript
// Find areas with persistent hazards
const allHazards = sessions.flatMap(s => s.hazards);
const hazardsByGeohash = groupBy(allHazards, h => h.geohash);

const hotspots = Object.entries(hazardsByGeohash)
  .filter(([_, hazards]) => hazards.length >= 5)
  .map(([geohash, hazards]) => ({
    geohash,
    count: hazards.length,
    avgSeverity: average(hazards.map(h => h.severity)),
    location: ngeohash.decode(geohash)
  }));
```

**Priority Ranking**:
```typescript
// Rank cities by infrastructure degradation
const cities = groupBy(sessions, s => s.location.city);

const rankings = Object.entries(cities).map(([city, sessions]) => {
  const latest = sessions.sort((a, b) => b.temporal.captureStart - a.temporal.captureStart)[0];
  const totalHazards = latest.metadata.totalHazards;
  const avgSeverity = average(latest.hazards.map(h => h.severity));
  const areaKm2 = latest.coverage.areaKm2;
  
  return {
    city,
    hazardDensity: totalHazards / areaKm2,
    avgSeverity,
    priorityScore: (totalHazards / areaKm2) * avgSeverity
  };
}).sort((a, b) => b.priorityScore - a.priorityScore);
```

---

## Implementation Roadmap

### Phase 1: Schema Migration (2 hours)
1. Update `MapFileSchema` in `packages/shared/src/mapFile.ts`
2. Add migration function to convert old sessions to new format
3. Update IndexedDB schema with new indexes

### Phase 2: Session Creation UI (4 hours)
1. Add bounding box drawing tool to map
2. Implement adaptive geohash precision calculation
3. Update `NewSessionView.tsx` to use new schema
4. Add location hierarchy selector (continent → country → state → city)

### Phase 3: Storage & Querying (3 hours)
1. Update `mapFileDB.ts` with new indexes
2. Implement query functions (by location, time, overlap)
3. Add session finalization workflow

### Phase 4: UI Organization (3 hours)
1. Implement hierarchical folder view in `MapFileExplorer`
2. Add temporal filtering (date range picker)
3. Add geographical filtering (location selector)

### Phase 5: Analysis Features (4 hours)
1. Implement temporal diff analysis
2. Add hotspot identification
3. Add priority ranking dashboard

**Total Estimated Time**: 16 hours

---

## Benefits of Proposed System

### 1. Clear Geographical Scope
- ✅ Bounding box defines exact coverage area
- ✅ Geohash tiles enable efficient spatial queries
- ✅ Can determine session overlap
- ✅ Adaptive precision for different area sizes

### 2. Rich Temporal Information
- ✅ Capture period (start/end) separate from creation time
- ✅ Session status (collecting/finalized/archived)
- ✅ Duration tracking
- ✅ Easy temporal queries

### 3. Hierarchical Organization
- ✅ Virtual folder structure (continent → country → state → city)
- ✅ Human-readable naming convention
- ✅ Easy to find related sessions

### 4. Powerful Analysis
- ✅ Track infrastructure changes over time
- ✅ Identify persistent hotspots
- ✅ Rank cities by priority
- ✅ Compare same area across different periods

### 5. Scalability
- ✅ Efficient IndexedDB indexes
- ✅ Geohash-based spatial queries
- ✅ LRU eviction for quota management
- ✅ Support for city-level to national-level sessions

---

## Conclusion

The current implementation has a weak geographical/temporal model. The proposed system provides:
- **Clear geographical boundaries** (bounding box + geohash tiles)
- **Rich temporal metadata** (capture period, status, duration)
- **Hierarchical organization** (location-based folders)
- **Powerful querying** (by location, time, overlap)
- **Meaningful analysis** (decay tracking, hotspots, priority ranking)

This enables the core use case: **observing road infrastructure changes across time and identifying high-priority regions**.

---

**Next Steps**: Approve proposal → Implement Phase 1 (schema migration)
