# VIGIA: Component Specifications

**Project**: Sentient Road Infrastructure System  
**Version**: 2.0 (Consolidated)  
**Last Updated**: March 3, 2026  
**Status**: Production Implementation

---

## 1. Frontend Components

### 1.1 Core Components

#### VideoUploader.tsx
**Purpose**: Handle video upload and frame extraction

**Props**:
```typescript
interface VideoUploaderProps {
  onTelemetryGenerated: (telemetry: SignedTelemetry) => void;
}
```

**State**:
- `videoFile`: File | null
- `isProcessing`: boolean
- `detectionCount`: number
- `telemetryBatch`: SignedTelemetry[]

**Key Methods**:
- `handleUpload(file: File)`: Load video into player
- `extractFrame(video: HTMLVideoElement)`: Capture 640x640 frame
- `processFrame(frameBuffer: ArrayBuffer)`: Send to Web Worker
- `sendBatch()`: POST telemetry to API Gateway (every 5s)

**Implementation Details**:
- Extract frames at 5 FPS (200ms interval)
- Use Canvas API for frame capture
- Batch telemetry for 5 seconds before sending
- Display real-time detection log

---

#### MapView.tsx
**Purpose**: Render interactive map with hazards and routes

**Props**:
```typescript
interface MapViewProps {
  hazards: Hazard[];
  routes?: Route[];
  diffState?: DiffResult;
  branchState?: ScenarioBranch;
  onHazardClick: (hazard: Hazard) => void;
}
```

**State**:
- `map`: maplibregl.Map | null
- `markers`: Map<string, maplibregl.Marker>
- `activeLayer`: 'default' | 'diff' | 'branch'

**Key Methods**:
- `initializeMap()`: Create MapLibre instance with Amazon Location Service
- `renderHazards(hazards: Hazard[])`: Add markers to map
- `renderDiff(diffResult: DiffResult)`: Color-code markers (RED/GREEN/ORANGE)
- `renderBranch(branch: ScenarioBranch)`: Show simulated hazards with dashed borders
- `renderRoute(route: Route)`: Draw polyline with segment colors

**Implementation Details**:
- Use MapLibre GL JS v3
- Marker clustering for dense areas
- Custom marker icons per hazard type
- Tooltip on hover with verification score

---

#### HazardVerificationPanel.tsx
**Purpose**: Manual hazard verification with real-time thinking visualization

**Props**:
```typescript
interface HazardVerificationPanelProps {
  hazards: Hazard[];
  onVerificationComplete: (hazardId: string, score: number) => void;
}
```

**State**:
- `selectedHazard`: Hazard | null
- `isVerifying`: boolean
- `verificationResult`: VerificationResult | null

**Key Methods**:
- `handleVerifyHazard(hazard: Hazard)`: POST to /verify-hazard-sync
- `emitVerificationEvents(steps: ReActStep[])`: Dispatch custom events for Agent Traces tab
- `updateHazardStatus(hazardId: string, status: string)`: Update UI

**Implementation Details**:
- Right-click context menu on pending hazards
- Sequential step emission with 800ms delays for streaming effect
- Emits events: `verification-start`, `verification-step`, `verification-complete`
- Stores hazard as "unverified" before verification begins

---

#### ReasoningTraceViewer.tsx
**Purpose**: Display agent thinking steps in Copilot/Claude style

**Props**: None (listens to global events)

**State**:
- `thinkingSteps`: ReActStep[]
- `isThinking`: boolean
- `trace`: ReasoningTrace | null

**Key Methods**:
- `handleVerificationStart()`: Clear steps, show "Agent thinking..."
- `handleVerificationStep(step: ReActStep)`: Append step with animation
- `handleVerificationComplete(result: VerificationResult)`: Show final reasoning

**Implementation Details**:
- Listens for custom events from HazardVerificationPanel
- Animated step appearance (slideIn animation)
- Visual hierarchy:
  - 💭 Thought (gray, italic)
  - ▸ Action (blue, bold)
  - → Observation (green)
- Final reasoning box with checkmark icon
- Uses JetBrains Mono font

---

#### AgentTracesTab.tsx
**Purpose**: Display all agent reasoning traces with search/filter

**Props**: None (uses agentTraceStore)

**State**:
- `traces`: ReActTrace[] (from Zustand store)
- `filter`: string
- `isStreaming`: boolean
- `autoScroll`: boolean

**Key Methods**:
- `connectSSE()`: Establish Server-Sent Events connection
- `appendTrace(trace: ReActTrace)`: Add new trace to list
- `filterTraces(query: string)`: Filter by geohash or contributor ID
- `exportTraces()`: Download traces as JSON

**Implementation Details**:
- Virtual scrolling with react-window (handles 1000+ traces)
- SSE connection to /api/agent-traces/stream
- Real-time updates without polling
- Search highlights matching text
- Auto-scroll toggle

---

#### MapFileExplorer.tsx
**Purpose**: File system explorer for .map and .scmap files

**Props**: None (uses mapFileStore)

**State**:
- `files`: Map<string, MapFile | ScenarioBranch> (from Zustand store)
- `expandedFolders`: Set<string>
- `contextMenu`: { x: number; y: number; fileId: string } | null

**Key Methods**:
- `handleFileDrop(fileId: string, targetId: string)`: Trigger diff computation
- `handleRightClick(fileId: string)`: Show context menu
- `createBranch(parentId: string)`: Generate .scmap file
- `loadFile(file: File)`: Parse and store in IndexedDB

**Implementation Details**:
- Drag-and-drop for diff comparison
- Right-click context menu:
  - Open
  - Create Branch
  - Compare with...
  - Export
- Visual distinction: 📄 for .map, 🌿 for .scmap
- Nested display: branches under parent files

---

#### DiffLayer.tsx
**Purpose**: Render diff visualization on map

**Props**:
```typescript
interface DiffLayerProps {
  diffResult: DiffResult;
  onClearDiff: () => void;
}
```

**State**: None (stateless component)

**Key Methods**:
- `renderNewHazards()`: RED markers
- `renderFixedHazards()`: GREEN markers
- `renderWorsenedHazards()`: ORANGE markers
- `renderLegend()`: Show hazard count deltas

**Implementation Details**:
- Uses MapLibre data-driven styling
- Legend overlay with counts: "+12 new, -5 fixed, 3 worsened"
- Export button generates JSON report
- Clear button removes diff layer

---

#### BranchLayer.tsx
**Purpose**: Render scenario branch with simulated hazards

**Props**:
```typescript
interface BranchLayerProps {
  branch: ScenarioBranch;
  onToggleHazard: (hazardId: string) => void;
  onAddHazard: (lat: number, lon: number) => void;
  onRecomputeRoutes: () => void;
}
```

**State**:
- `isRecomputing`: boolean
- `comparisonResult`: RoutingComparison | null

**Key Methods**:
- `renderSimulatedHazards()`: Dashed border markers
- `handleHazardToggle(hazardId: string)`: Update branch state
- `handleMapClick(lat: number, lon: number)`: Add simulated hazard
- `recomputeRoutes()`: POST to /api/routing-agent/branch

**Implementation Details**:
- Dashed borders for simulated hazards
- Click to toggle closure
- Right-click map to add hazard
- Comparison widget shows latency delta
- Caches routing results by SHA-256 hash

---

#### MaintenancePanel.tsx
**Purpose**: Submit and track maintenance reports

**Props**: None (uses economicStore)

**State**:
- `selectedHazard`: Hazard | null
- `notes`: string
- `isSubmitting`: boolean

**Key Methods**:
- `handleSubmitReport(report: MaintenanceReport)`: POST to /api/maintenance/report
- `calculateEstimatedCost(type: HazardType, severity: number)`: Auto-calculate cost
- `fetchMaintenanceQueue()`: Load pending reports

**Implementation Details**:
- Auto-calculates repair cost: `baseCost[type] * (1 + severity * 0.2)`
- Requires ECDSA signature
- Displays maintenance queue with status
- Updates ROI widget on submission

---

#### DePINLedgerTab.tsx
**Purpose**: Display ledger ticker and ROI widget

**Props**: None (uses economicStore)

**State**:
- `metrics`: EconomicMetrics | null
- `ledgerEntries`: LedgerEntry[]
- `isScrolling`: boolean

**Key Methods**:
- `fetchMetrics(sessionId: string)`: Load ROI data
- `fetchLedgerEntries()`: Load recent contributions
- `startTicker()`: Auto-scroll ledger

**Implementation Details**:
- ROI widget at top:
  - Total hazards detected
  - Estimated repair cost
  - Prevented damage cost
  - ROI multiplier
  - Hazard breakdown by type
- Scrolling ticker at bottom
- Updates every 10 seconds
- Color-coded by hazard type

---

### 1.2 Web Workers

#### hazard-detector.worker.ts
**Purpose**: ONNX inference and telemetry signing

**Exposed Methods**:
```typescript
class HazardDetectorWorker {
  async loadModel(): Promise<void>;
  async processFrame(
    frameBuffer: ArrayBuffer,
    gpsCoords: { lat: number; lon: number }
  ): Promise<SignedTelemetry | null>;
}
```

**Implementation**:
1. Load YOLOv8-nano ONNX model
2. Preprocess frame (RGBA → RGB, normalize)
3. Run inference
4. Postprocess results (NMS, confidence filter)
5. Map YOLO classes to hazard types
6. Sign telemetry with Web Crypto API
7. Return signed payload

**Performance**:
- Inference: <200ms on mid-range laptop
- Uses WASM execution provider
- Caches model in memory

---

#### diffWorker.ts
**Purpose**: Compute diff between two .map files

**Exposed Methods**:
```typescript
class DiffWorker {
  async computeDiff(
    fileA: MapFile,
    fileB: MapFile
  ): Promise<DiffResult>;
}
```

**Implementation**:
1. Parse JSON files
2. Create Map<hazardId, Hazard> for fast lookup
3. Compute set differences:
   - New: In B, not in A
   - Fixed: In A, not in B
   - Worsened: In both, severity increased
4. Return structured result

**Performance**:
- <2s for 500 hazards per file
- Uses Set operations for efficiency

---

#### branchWorker.ts
**Purpose**: Manage .scmap file I/O and simulation state

**Exposed Methods**:
```typescript
class BranchWorker {
  async createBranch(parentId: string): Promise<ScenarioBranch>;
  async saveBranchChanges(branchId: string, changes: SimulatedChanges): Promise<void>;
  async loadBranch(branchId: string): Promise<ScenarioBranch>;
}
```

**Implementation**:
1. Read parent .map file from IndexedDB
2. Clone hazards array
3. Generate unique branchId
4. Store in IndexedDB with LRU eviction
5. Persist changes on user edits

**Performance**:
- Branch creation: <500ms
- LRU eviction: Max 10 branches, 50MB quota

---

### 1.3 Zustand Stores

#### mapFileStore.ts
```typescript
interface MapFileStore {
  files: Map<string, MapFile | ScenarioBranch>;
  activeFileId: string | null;
  diffState: DiffResult | null;
  
  loadFile: (file: File) => Promise<void>;
  createBranch: (parentId: string) => Promise<string>;
  computeDiff: (fileAId: string, fileBId: string) => Promise<DiffResult>;
  saveBranchChanges: (branchId: string, changes: SimulatedChanges) => void;
  clearDiff: () => void;
}
```

**Implementation**:
- Uses IndexedDB for persistence
- Delegates diff computation to diffWorker
- Delegates branch management to branchWorker
- Emits events for UI updates

---

#### agentTraceStore.ts
```typescript
interface AgentTraceStore {
  traces: ReActTrace[];
  filter: string;
  isStreaming: boolean;
  sseConnection: EventSource | null;
  
  connectSSE: (url: string) => void;
  disconnectSSE: () => void;
  appendTrace: (trace: ReActTrace) => void;
  filterTraces: (query: string) => void;
  clearTraces: () => void;
}
```

**Implementation**:
- Establishes SSE connection to /api/agent-traces/stream
- Parses incoming trace events
- Maintains in-memory trace buffer (max 1000)
- Supports client-side filtering

---

#### economicStore.ts
```typescript
interface EconomicStore {
  metrics: EconomicMetrics | null;
  maintenanceQueue: MaintenanceReport[];
  
  fetchMetrics: (sessionId: string) => Promise<void>;
  submitMaintenanceReport: (report: Omit<MaintenanceReport, "reportId">) => Promise<void>;
  fetchMaintenanceQueue: () => Promise<void>;
  updateReportStatus: (reportId: string, status: string) => Promise<void>;
}
```

**Implementation**:
- Fetches metrics from /api/economic/metrics
- Submits reports to /api/maintenance/report
- Caches metrics with 5-minute TTL
- Updates ROI widget on changes

---

## 2. Backend Components

### 2.1 Lambda Functions

#### validator/index.ts
**Purpose**: Validate and store telemetry

**Handler Signature**:
```typescript
export const handler: APIGatewayProxyHandler = async (event) => {
  // 1. Parse payload
  // 2. Validate schema
  // 3. Verify signature
  // 4. Compute geohash
  // 5. Write to DynamoDB
  // 6. Return 200 or 400
};
```

**Key Functions**:
- `validateSchema(payload: any)`: JSON Schema validation
- `verifySignature(payload: any, publicKey: string)`: ECDSA verification
- `computeGeohash(lat: number, lon: number)`: Geohash encoding

**Error Handling**:
- Invalid schema → HTTP 400
- Invalid signature → HTTP 400
- DynamoDB error → HTTP 500

---

#### orchestrator/index.py
**Purpose**: Orchestrate Bedrock Agent verification

**Handler Signature**:
```python
def lambda_handler(event, context):
    for record in event['Records']:
        if record['eventName'] == 'INSERT':
            hazard = parse_dynamodb_record(record)
            
            # Check cooldown
            if is_in_cooldown(hazard):
                continue
            
            # Invoke Bedrock Agent
            result = invoke_bedrock_agent(hazard)
            
            # Update hazard status
            if result['verificationScore'] >= 70:
                mark_as_verified(hazard)
                write_to_ledger(hazard, result)
            
            # Store reasoning trace
            store_trace(result)
            
            # Write cooldown entry
            write_cooldown(hazard)
```

**Key Functions**:
- `invoke_bedrock_agent(hazard)`: Call Bedrock with prompt
- `parse_agent_response(response)`: Extract ReAct steps
- `write_to_ledger(hazard, result)`: Create ledger entry with hash chain
- `store_trace(result)`: Save to AgentTraces table

**Performance**:
- Timeout: 30s
- Memory: 512 MB
- Concurrent executions: 10

---

#### verify-hazard-sync/index.ts
**Purpose**: Manual hazard verification with real-time thinking

**Handler Signature**:
```typescript
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const request: VerifyRequest = JSON.parse(event.body || '{}');
  
  // Store hazard as unverified
  await storeHazard(request);
  
  // Log telemetry submission to traces
  await logTelemetryTrace(request);
  
  // Invoke Bedrock Agent or use simulation
  const steps = await verifyHazard(request);
  
  // Return structured response
  return {
    statusCode: 200,
    body: JSON.stringify({ steps, verificationScore, reasoning }),
  };
};
```

**Key Functions**:
- `storeHazard(request)`: Write to Hazards table with status "unverified"
- `logTelemetryTrace(request)`: Create trace entry for telemetry submission
- `verifyHazard(request)`: Invoke Bedrock or simulate
- `parseReActSteps(response)`: Extract thinking, action, observation

**Simulation Mode**:
- Used when Bedrock Agent not configured
- Generates realistic thinking steps
- Returns human-readable observations

---

#### hash-chain-validator/index.ts
**Purpose**: Validate ledger hash chain integrity

**Handler Signature**:
```typescript
export const handler: DynamoDBStreamHandler = async (event) => {
  for (const record of event.Records) {
    if (record.eventName === 'INSERT') {
      const newEntry = parseLedgerEntry(record);
      const previousEntry = await fetchPreviousEntry(newEntry.ledgerId);
      
      const expectedHash = computeHash(newEntry, previousEntry.currentHash);
      
      if (expectedHash !== newEntry.currentHash) {
        await raiseAlert('HASH_CHAIN_BROKEN', newEntry);
      }
    }
  }
};
```

**Key Functions**:
- `computeHash(entry, previousHash)`: SHA-256 computation
- `fetchPreviousEntry(ledgerId)`: Query DynamoDB
- `raiseAlert(type, entry)`: Publish to SNS topic

**Security**:
- Read-only access to ledger table
- SNS topic for critical alerts

---

#### routing-agent-branch/index.ts
**Purpose**: Recompute routes for scenario branches

**Handler Signature**:
```typescript
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const { branchId, hazards } = JSON.parse(event.body!);
  
  // Filter active hazards
  const activeHazards = hazards.filter(h => !h.removed);
  
  // Invoke Bedrock Agent with branch context
  const response = await invokeRoutingAgent(branchId, activeHazards);
  
  // Parse routing results
  const { baselineLatency, branchLatency } = parseRoutingResponse(response);
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      baselineAvgLatency: baselineLatency,
      branchAvgLatency: branchLatency,
      delta: branchLatency - baselineLatency,
      deltaPercent: ((branchLatency - baselineLatency) / baselineLatency) * 100,
    }),
  };
};
```

**Key Functions**:
- `invokeRoutingAgent(branchId, hazards)`: Call Bedrock
- `parseRoutingResponse(response)`: Extract latency metrics
- `cacheResult(branchId, result)`: Store in DynamoDB with TTL

**Caching**:
- Cache key: SHA-256 hash of hazard array
- TTL: 5 minutes
- Reduces Bedrock API calls

---

#### agent-trace-streamer/index.ts
**Purpose**: Stream agent traces via Server-Sent Events

**Handler Signature**:
```typescript
export const handler = awslambda.streamifyResponse(
  async (event: APIGatewayProxyEvent, responseStream: any): Promise<void> => {
    const { telemetry } = JSON.parse(event.body!);
    
    const response = await bedrockAgent.invokeAgent({
      agentId: process.env.ORCHESTRATOR_AGENT_ID,
      sessionId: telemetry.contributorId,
      inputText: JSON.stringify(telemetry),
      enableTrace: true,
    });
    
    // Stream traces as SSE
    for await (const chunk of response.completion) {
      if (chunk.trace) {
        const trace = parseReActTrace(chunk.trace);
        responseStream.write(`data: ${JSON.stringify(trace)}\n\n`);
        
        // Persist to DynamoDB
        await dynamodb.putItem({
          TableName: "AgentTraces",
          Item: { ...trace, ttl: Math.floor(Date.now() / 1000) + 604800 },
        });
      }
    }
    
    responseStream.end();
  }
);
```

**Key Functions**:
- `parseReActTrace(chunk)`: Extract structured trace
- `streamTrace(trace, responseStream)`: Send SSE event
- `persistTrace(trace)`: Write to DynamoDB

**Performance**:
- Timeout: 60s
- Memory: 1024 MB
- Supports long-lived connections

---

#### maintenance-report-handler/index.ts
**Purpose**: Handle maintenance report submissions

**Handler Signature**:
```typescript
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const report: Omit<MaintenanceReport, "reportId"> = JSON.parse(event.body!);
  
  // Verify signature
  const isValid = await verifyECDSA(report.signature, report.hazardId);
  if (!isValid) return { statusCode: 403, body: "Invalid signature" };
  
  // Calculate estimated cost
  const estimatedCost = calculateRepairCost(report.type, report.severity);
  
  const reportId = uuidv4();
  await dynamodb.putItem({
    TableName: "MaintenanceQueue",
    Item: { ...report, reportId, estimatedCost, status: "PENDING" },
  });
  
  // Update economic metrics
  await updateEconomicMetrics(report.geohash, estimatedCost);
  
  return {
    statusCode: 201,
    body: JSON.stringify({ reportId, estimatedCost }),
  };
};
```

**Key Functions**:
- `calculateRepairCost(type, severity)`: Cost formula
- `verifyECDSA(signature, hazardId)`: Signature validation
- `updateEconomicMetrics(geohash, cost)`: Update aggregated metrics

**Cost Formula**:
```typescript
const baseCosts = {
  POTHOLE: 150,
  DEBRIS: 50,
  FLOODING: 1000,
  ACCIDENT: 0,
};
return baseCosts[type] * (1 + severity * 0.2);
```

---

### 2.2 Bedrock Agent Action Groups

#### queryHazards (Python Lambda)
**Purpose**: Query DynamoDB for similar hazards

**Input Schema**:
```json
{
  "geohash": "string",
  "radiusMeters": "number",
  "hoursBack": "number"
}
```

**Output Schema**:
```json
{
  "hazards": [
    {
      "id": "string",
      "type": "string",
      "severity": "number",
      "timestamp": "string",
      "confidence": "number"
    }
  ],
  "count": "number"
}
```

**Implementation**:
1. Decode geohash to lat/lon
2. Get neighboring geohashes
3. Query DynamoDB for each geohash
4. Filter by distance (geodesic calculation)
5. Filter by time window
6. Return matching hazards

---

#### calculateScore (Python Lambda)
**Purpose**: Compute verification score

**Input Schema**:
```json
{
  "similarHazards": "array",
  "confidence": "number"
}
```

**Output Schema**:
```json
{
  "verificationScore": "number",
  "breakdown": {
    "countScore": "number",
    "confidenceScore": "number",
    "temporalScore": "number"
  }
}
```

**Scoring Formula**:
```python
count_score = min(len(similar_hazards) * 20, 40)
confidence_score = confidence * 30
recent_count = sum(1 for h in similar_hazards if is_within_hours(h['timestamp'], 6))
temporal_score = min(recent_count * 10, 30)
total_score = count_score + confidence_score + temporal_score
```

---

## 3. Integration Patterns

### 3.1 Frontend → Backend

**Telemetry Submission**:
```
VideoUploader → Web Worker → Batch (5s) → POST /telemetry → Validator Lambda → DynamoDB
```

**Manual Verification**:
```
HazardVerificationPanel → POST /verify-hazard-sync → Verify Lambda → Bedrock Agent → Response
  ↓
ReasoningTraceViewer (listens to events) → Display thinking steps
```

**Diff Computation**:
```
MapFileExplorer (drag-and-drop) → diffWorker → DiffResult → MapView (render markers)
```

**Branch Simulation**:
```
MapFileExplorer (right-click) → branchWorker → Create .scmap → MapView (render branch)
  ↓
User edits → branchWorker (save changes) → POST /api/routing-agent/branch → Routing Lambda
  ↓
ComparisonWidget (display latency delta)
```

### 3.2 Backend → Frontend

**SSE Streaming**:
```
Agent Trace Streamer Lambda → SSE → AgentTracesTab (EventSource) → Append trace
```

**DynamoDB Streams**:
```
Hazards Table (INSERT) → Orchestrator Lambda → Bedrock Agent → Update status
  ↓
Ledger Table (INSERT) → Hash Validator Lambda → Verify integrity
```

---

## 4. Error Handling

### 4.1 Frontend

**Network Errors**:
- Exponential backoff for failed API calls
- Retry up to 3 times
- Display user-friendly error messages

**Worker Errors**:
- Catch exceptions in worker message handlers
- Terminate and restart worker on critical errors
- Log errors to console for debugging

**State Errors**:
- Zustand stores handle errors gracefully
- Reset to initial state on unrecoverable errors
- Display error boundaries for React components

### 4.2 Backend

**Lambda Errors**:
- Try-catch blocks around all async operations
- Return structured error responses (HTTP 400/500)
- Log errors to CloudWatch with context

**DynamoDB Errors**:
- Handle throttling with exponential backoff
- Use on-demand billing to prevent throttling
- Batch writes to reduce request count

**Bedrock Errors**:
- Handle rate limits (retry with backoff)
- Fallback to cached responses if available
- Log token usage for cost monitoring

---

**Document Status**: ✅ Complete - All components implemented and tested
