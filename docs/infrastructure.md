# VIGIA — Cloud Infrastructure Reference

## Overview

VIGIA runs entirely on AWS serverless infrastructure + Solana Devnet. Zero servers, zero idle costs. The architecture is deployed via AWS CDK (TypeScript) as a single CloudFormation stack (`VigiaStack`) with 5 nested constructs.

**Region**: `us-east-1`  
**Stack**: `VigiaStack`  
**CDK**: `packages/infrastructure/`

---

## Stack Architecture

```
VigiaStack
├── Ingestion Stack      — telemetry intake, device registry, frame storage
├── Trust Stack          — append-only ledger with hash chain
├── Intelligence Stack   — AI verification, orchestration, rewards
├── Innovation Stack     — agent chat, maintenance, economic metrics
├── Session Stack        — user sessions, geohash resolution
└── Enterprise Stack     — B2B auth, burn mechanics, data credits
```

---

## 1. API Gateways (4)

| Name | ID | Purpose | Endpoints |
|---|---|---|---|
| VIGIA Telemetry API | `sq2ri2n51g` | Edge node telemetry intake | `/telemetry`, `/register-device` |
| VIGIA Session API | `eepqy4yku7` | Session CRUD, hazard queries | `/sessions`, `/hazards`, `/ledger`, `/traces` |
| VIGIA Innovation API | `p4qc9upgsf` | Agent chat, maintenance, metrics | `/agent-chat`, `/maintenance/*`, `/economic/*`, `/rewards-balance` |
| vigia-enterprise-api | `m1ots3cacc` | Enterprise auth + burn | `/register`, `/login`, `/me`, `/burn`, `/stats` |

**Pricing**: $3.50/1M requests. All APIs use REST (not HTTP API) for WAF compatibility.

---

## 2. DynamoDB Tables (15 active)

### Ingestion Stack

| Table | PK | SK | GSIs | Purpose |
|---|---|---|---|---|
| **HazardsTable** | `geohash` (S) | `timestamp` (S) | `status-timestamp-index`, `h3-hazardtype-index` | All detected hazards. Stream-enabled → Orchestrator |
| **VigiaDeviceRegistry** | `device_address` (S) | — | — | Ed25519 pubkey registry. Fail-closed auth |

**HazardsTable Stream**: `NEW_AND_OLD_IMAGES` → EventBridge Pipe (INSERT filter) → Orchestrator Lambda

### Trust Stack

| Table | PK | SK | GSIs | Purpose |
|---|---|---|---|---|
| **TrustLedgerTable** | `ledgerId` (S) | `timestamp` (S) | `ContributorGeohashIndex` | Append-only hash chain. Reward dedup via GSI |

**Hash chain**: Each entry contains `previousHash` + `currentHash = SHA256(entry)`. Tamper-evident.

### Intelligence Stack

| Table | PK | SK | GSIs | Purpose |
|---|---|---|---|---|
| **AgentTracesTable** | `traceId` (S) | — | `HazardIdIndex` (hazardId + createdAt) | VLM reasoning, agent ReAct steps, verdict. TTL: 7 days |
| **CooldownTable** | `cooldownKey` (S) | — | — | Prevents duplicate orchestrator invocations. TTL: 30s |
| **RewardsLedgerTable** | `wallet_address` (S) | — | — | Off-chain reward accrual (legacy, being replaced by Solana) |

### Innovation Stack

| Table | PK | SK | GSIs | Purpose |
|---|---|---|---|---|
| **MaintenanceQueueTable** | `reportId` (S) | `reportedAt` (N) | `GeohashIndex`, `StatusIndex` | Repair reports with priority + cost estimates |
| **EconomicMetricsTable** | `sessionId` (S) | `timestamp` (N) | — | ROI calculations, savings projections |
| **AgentRateLimitTable** | `pk` (S) | — | — | IP-based rate limiting. TTL-based expiry |

### Session Stack

| Table | PK | SK | GSIs | Purpose |
|---|---|---|---|---|
| **SessionFilesTable** | `userId` (S) | `sessionId` (S) | `geohash7-timestamp-index`, `status-timestamp-index` | User detection sessions |
| **SessionLedgerEntries** | `ledgerId` (S) | `timestamp` (S) | — | Per-session ledger entries |

**Billing**: All tables use `PAY_PER_REQUEST` (on-demand). Zero idle costs.

---

## 3. Lambda Functions (27)

### Ingestion (6 functions)

| Function | Runtime | Memory | Timeout | Purpose |
|---|---|---|---|---|
| **ValidatorFunction** | Node.js 20 | 128MB | 10s | Ed25519 verify → S3 frame upload → DynamoDB write |
| **RegisterDeviceFunction** | Node.js 20 | 128MB | 10s | Idempotent device registration (base58 pubkey) |
| **HazardsGetterFunction** | Node.js 20 | 128MB | 10s | GET /hazards — scan with geo filter |
| **LedgerGetterFunction** | Node.js 20 | 128MB | 10s | GET /ledger — recent entries |
| **TracesGetterFunction** | Node.js 20 | 128MB | 10s | GET /traces — by traceId |
| **TracesByHazardFunction** | Node.js 20 | 128MB | 10s | GET /traces/{hazardId} — by hazard |

### Intelligence (11 functions)

| Function | Runtime | Memory | Timeout | Purpose |
|---|---|---|---|---|
| **OrchestratorFunction** | Node.js 20 | 128MB | 120s | Core pipeline: S3 → VLM → Agent → Solana |
| **BedrockRouterFunction** | Python 3.12 | 128MB | 30s | Agent action group: query_hazards, scan_all, coordinates_to_geohash |
| **NetworkIntelligenceFunction** | Python 3.12 | 128MB | 30s | Agent action group: node connectivity, coverage gaps |
| **MaintenanceLogisticsFunction** | Python 3.12 | 128MB | 30s | Agent action group: repair queue, cost estimation |
| **UrbanPlannerFunction** | Python 3.12 | 128MB | 30s | Invokes Step Functions for path planning |
| **GenerateBezierPathFunction** | Python 3.12 | 128MB | 10s | Step Functions branch: Bezier path generation |
| **CalculateLandCostFunction** | Python 3.12 | 128MB | 5s | Step Functions branch: construction cost |
| **CheckZoneRegulationsFunction** | Python 3.12 | 128MB | 10s | Step Functions branch: geofence compliance |
| **VerifyHazardSyncFunction** | Node.js 20 | 256MB | 29s | Legacy sync verification (being deprecated) |
| **RewardsBalanceFunction** | Node.js 20 | 128MB | 10s | GET /rewards-balance — read wallet balance |
| **ClaimSignatureFunction** | Node.js 20 | 256MB | 15s | Legacy KMS claim signing (deprecated by Solana) |

### Innovation (5 functions)

| Function | Runtime | Memory | Timeout | Purpose |
|---|---|---|---|---|
| **RoutingAgentBranchFunction** | Node.js 20 | 512MB | 30s | Agent chat with context routing |
| **AgentTraceStreamerFunction** | Node.js 20 | 1024MB | 60s | SSE streaming of agent ReAct traces |
| **MaintenanceReportHandlerFunction** | Node.js 20 | 256MB | 10s | POST /maintenance/report |
| **EconomicMetricsQueryFunction** | Node.js 20 | 256MB | 5s | GET /economic/metrics |
| **MaintenanceQueueQueryFunction** | Node.js 20 | 256MB | 5s | GET /maintenance/queue |

### Session (4 functions)

| Function | Runtime | Memory | Timeout | Purpose |
|---|---|---|---|---|
| **SessionCRUDFunction** | Node.js 20 | 128MB | 30s | Create/read/update/delete sessions |
| **GeohashResolverFunction** | Node.js 20 | 128MB | 10s | Lat/lon → geohash conversion |
| **HashChainValidatorFunction** | Node.js 20 | 128MB | 10s | Verify ledger hash chain integrity |
| **PlacesSearchFunction** | Node.js 20 | 128MB | 10s | AWS Location Service places search |

---

## 4. Amazon Bedrock

### Agent Configuration

| Property | Value |
|---|---|
| Agent ID | `TAWWC3SQ0L` |
| Agent Alias | `TSTALIASID` |
| Foundation Model | Amazon Nova Lite (`amazon.nova-lite-v1:0`) |
| Orchestration | DEFAULT (ReAct) |

### Action Groups (4)

| Group | Lambda | Tools |
|---|---|---|
| QueryAndVerify | BedrockRouterFunction | `query_hazards`, `calculate_score`, `coordinates_to_geohash`, `scan_all_hazards` |
| NetworkIntelligence | NetworkIntelligenceFunction | `analyze_node_connectivity`, `identify_coverage_gaps` |
| MaintenanceLogistics | MaintenanceLogisticsFunction | `prioritize_repair_queue`, `estimate_repair_cost` |
| UrbanPlanner | UrbanPlannerFunction | `find_optimal_path` (invokes Step Functions) |

### Direct Model Calls

| Caller | Model | Purpose |
|---|---|---|
| Orchestrator Lambda | Nova Lite (Converse API) | VLM image analysis — is this a real hazard? |
| Orchestrator Lambda | Nova Lite (InvokeAgent) | ReAct verification with tool calls |

---

## 5. Step Functions

### Urban Planner State Machine (Express)

| Property | Value |
|---|---|
| Type | EXPRESS (synchronous, <5s) |
| Definition | `urban-planner.asl.json` |
| Execution time | ~206ms average |

**Parallel branches**:
1. `GenerateBezierPath` — Bezier curve waypoints between two points
2. `CalculateLandCost` — construction cost estimation
3. `CheckZoneRegulations` — Amazon Location Service geofence evaluation

---

## 6. EventBridge Pipes (2)

| Pipe | Source | Filter | Target | Purpose |
|---|---|---|---|---|
| HazardsToOrchestrator | HazardsTable Stream | `{"eventName": ["INSERT"]}` | Orchestrator Lambda | Trigger verification on new hazards |
| VerifiedToMaintenance | HazardsTable Stream | `{"eventName": ["MODIFY"], "dynamodb.NewImage.status.S": ["VERIFIED"]}` | SQS Queue | Fan out verified hazards to maintenance |

**Impact**: INSERT-only filter reduces Lambda invocations by ~60% (skips UPDATE/DELETE events).

---

## 7. S3 Buckets (2)

| Bucket | Purpose | Lifecycle | Access |
|---|---|---|---|
| `vigia-hazard-frames-203800220566` | Dashcam frame storage (JPEG) | 30-day expiry | Validator writes, Orchestrator reads |
| `vigia-static-assets-1772997117` | Static assets | None | Public read |

---

## 8. Amazon Location Service

| Resource | Type | Purpose |
|---|---|---|
| `VigiaMap` | Map (Esri) | Dark-themed road map for IDE |
| `VigiaSatelliteMap` | Map (Esri) | Satellite imagery layer |
| `VigiaTerrainMap` | Map (Esri) | Terrain/elevation layer |
| `VigiaRouteCalculator` | Route Calculator (Esri) | Fastest/safest route computation |
| `VigiaRestrictedZones` | Geofence Collection | 4 zones: Residential, Commercial, Industrial, Protected |

---

## 9. Secrets Manager

| Secret | Purpose |
|---|---|
| `vigia-public-key` | Legacy ECDSA public key (deprecated) |
| `vigia-solana-authority` | Solana Ed25519 keypair for Lambda signing (64-byte secretKey as JSON array) |

---

## 10. Solana (External — Not AWS)

| Component | Address | Purpose |
|---|---|---|
| Program | `BKaxbk73bCY8xRuphpkTESWjaJofdnBpuc2T193f3nkW` | VIGIA Anchor program (Devnet) |
| Authority | `7PTUbMJMWRwAixmkez2yBpsjovyAECtcXQHVYzAi8jf1` | Lambda signer (from Secrets Manager) |
| $VIGIA Mint | `5UXva9WVVQ5oxHTjf5tqryi94crHWNFbW84qRV1fBLTa` | SPL Token (6 decimals) |
| Mint Authority PDA | `93VTjeXiqa9iZYtwNpuhsu7THNGgYptUpuFcRMYay3Ja` | Program-controlled, signs mint_to |
| Global Merkle Tree | `HUWg7PsuqKtDxUe411mXNssfE2BSpq4ajao4GUab13LZ` | Validation event compression |
| Vault PDA | `3JiWf9TN3NaXHCmJdNuPVBbW6RxNFhfehXFgb3DuScYz` | Holds staked SOL |

---

## 11. IAM Roles

| Role | Attached To | Key Permissions |
|---|---|---|
| OrchestratorFunct-CJ35QP5Bz8wo | Orchestrator Lambda | DynamoDB R/W, S3 Read, Bedrock Invoke, Secrets Manager Read, Lambda Invoke |
| AmplifyBedrockRole | Amplify Hosting | DynamoDB Read, AdministratorAccess-Amplify |
| AmazonBedrockExecutionRoleForAgents_J6KZOKRLCDS | Bedrock Agent | bedrock:InvokeModel (Nova Lite) |

---

## 12. Deployment

### CDK Deploy
```bash
cd packages/infrastructure
npx cdk deploy --all
```

### Manual Lambda Deploy (faster iteration)
```bash
cd packages/backend
npx esbuild src/orchestrator/index.ts --bundle --platform=node --target=node20 --outfile=/tmp/orch/index.js --external:@aws-sdk/*
cd /tmp/orch && zip -q orch.zip index.js
aws lambda update-function-code --function-name <name> --zip-file fileb://orch.zip --region us-east-1
```

### Frontend (Amplify)
- Auto-deploys on push to `main` branch
- App ID: `d37hzf29nvf0f4`
- Platform: `WEB_COMPUTE` (Next.js SSR)
- Build spec: `amplify.yml` (monorepo root install → `npm run build`)
