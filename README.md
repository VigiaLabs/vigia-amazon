<div align="center">

![Tech Event Banner](https://github.com/user-attachments/assets/c7995ac9-c551-4ad8-b5b0-ea759cf8a63f)

# VIGIA — Cloud Pipeline

### Serverless attestation, DePIN reward, and AI orchestration backend for the VIGIA edge node and mobile app.

[![AWS CDK](https://img.shields.io/badge/AWS%20CDK-2.170.0-FF9900?style=flat-square&logo=amazonaws&logoColor=white)](https://aws.amazon.com/cdk/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3.3-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![AWS Lambda](https://img.shields.io/badge/AWS%20Lambda-Node.js%2020-FF9900?style=flat-square&logo=awslambda&logoColor=white)](https://aws.amazon.com/lambda/)
[![DynamoDB](https://img.shields.io/badge/DynamoDB-PAY--PER--REQUEST-4053D6?style=flat-square&logo=amazondynamodb&logoColor=white)](https://aws.amazon.com/dynamodb/)
[![AWS IoT Core](https://img.shields.io/badge/AWS%20IoT%20Core-MQTT-1A9C3E?style=flat-square&logo=amazonaws&logoColor=white)](https://aws.amazon.com/iot-core/)
[![Amazon Bedrock](https://img.shields.io/badge/Amazon%20Bedrock-Nova%20Lite-232F3E?style=flat-square&logo=amazonaws&logoColor=white)](https://aws.amazon.com/bedrock/)

**🏆 Global Finalist — Amazon AIdeas Hackathon 2026 ($10,000 prize track)**
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

</div>

---

## What the VIGIA Cloud Does — In One Sentence

The VIGIA cloud pipeline receives cryptographically-attested road-hazard events from Pi edge nodes over MQTT and from the mobile app over HTTPS, verifies each event with a probabilistic VLM + Bedrock ReAct agent pipeline, credits off-chain $VIGIA rewards to contributing wallets, and exposes the resulting verified hazard map, ledger, maintenance queue, and Stripe fiat-payout flows to the frontend IDE.

---

## Video Demo

[![VIGIA Demo](https://img.youtube.com/vi/cVD0lM7jQQk/maxresdefault.jpg)](https://youtu.be/cVD0lM7jQQk?si=9XQ2SyRwYv5h02uB)

![VigiaSense MultiModal System.](vigia_700p_final.gif)

---

## Table of Contents

1. [Why This Backend Stands Out](#why-this-backend-stands-out)
2. [Role in the VIGIA System](#role-in-the-vigia-system)
3. [Architecture](#architecture)
4. [Request Flows](#request-flows)
5. [Lambda Functions](#lambda-functions)
6. [Data Model](#data-model)
7. [Security Model](#security-model)
8. [Tech Stack](#tech-stack)
9. [Getting Started](#getting-started)
10. [Project Structure](#project-structure)
11. [About the Developer](#about-the-developer)
12. [License](#license)
13. [Resources](#resources)

---

## Why This Backend Stands Out

| Property | Detail |
|---|---|
| **Serverless, zero-idle cost** | All compute is Lambda (Node.js 20 / Python 3.12) behind API Gateway or IoT Core rules — no always-on servers. |
| **Cryptographically-verified ingestion** | Every mobile submission is Ed25519-verified server-side; every Pi MQTT event is ECDSA P-256-verified (ATECC608A hardware signer) with a 96-byte `EtHashInput` struct reconstructed and SHA-256-checked before the signature. |
| **Least-privilege IAM** | Each Lambda's role grants only the specific DynamoDB tables, S3 buckets, and Bedrock resources it touches; IoT Core device policy scopes each Pi to its own `${iot:ClientId}` topic. |
| **Atomic reward ledger** | Reward credit uses a DynamoDB `TransactWrite` (3-item transaction: cooldown lock + balance ADD + ledger PUT) — double-credit on concurrent invocations is structurally impossible. |
| **Probabilistic VLM verification** | Only 2% of events go through the expensive Nova Lite VLM + Bedrock ReAct Agent pipeline; the other 98% are scored deterministically from the edge ONNX confidence, keeping per-event cloud cost linear and predictable. |

---

## Role in the VIGIA System

```
  vigia-raspi (Raspberry Pi edge node)
  ├─ BLE → ATECC608A → MsgPack payload
  └─ MQTT TLS → AWS IoT Core
                    │  topic: vigia/attest/<device_id>/hazard
                    ▼
         IoT Topic Rule (vigia_hazard_attest)
                    │  SQL: SELECT encode(*,'base64') AS payload …
                    ▼
           AttestationFn (Lambda)
           ├─ MsgPack decode
           ├─ EtHashInput (96-byte) reconstruct + SHA-256
           ├─ ECDSA P-256 verify (ATECC608A sig via @noble/curves)
           ├─ Anti-replay: conditional DynamoDB seq watermark
           └─ H3 res-10 geo-dedup → HazardsTable UPSERT
                    │
  vigia2 (Android mobile app)                           │
  └─ POST /telemetry (Ed25519 signed)                   │
                    ▼                                   │
           ValidatorFn (API Gateway)                   │
           ├─ Ed25519 verify (tweetnacl)               │
           ├─ Device registry check                    │
           └─ HazardsTable PENDING write ──────────────┘
                    │
                    ▼  (DynamoDB Stream → EventBridge Pipe, INSERT only)
           OrchestratorFn
           ├─ 98%: deterministic fast path (ONNX score ≥ 0.65 → VERIFIED)
           └─ 2%:  S3 frame → Amazon Nova Lite VLM → Bedrock ReAct Agent
                       ├─ VERIFIED → tryCreditReward (TransactWrite)
                       │             └─ submitHazardToChain → Solana Anchor
                       └─ spoof (VLM < 0.1) → async SlashNodeFn
                    │
                    ▼
  Frontend IDE (Next.js / Amplify)
  ├─ GET /hazards, GET /ledger, GET /traces/{hazardId}
  ├─ GET /rewards-balance (wallet ownership proof)
  ├─ POST /stripe/payout-session (fiat payout via Stripe Connect)
  └─ POST /sarvam-proxy/stt|tts (Indian-language voice, key proxied)
```

---

## Architecture

### CDK Stack Map

```
VigiaStack (root)
├── TrustStack          — DePIN ledger DynamoDB table
├── SessionStack        — MFS session CRUD + hash-chain validator + geohash resolver
├── IntelligenceStack   — Orchestrator, Bedrock agent, EventBridge Pipes, Step Functions
│   (first pass)        — Traces table, CooldownTable, RewardsLedger
├── IngestionStack      — Telemetry API, Validator, AttestationFn, IoT Rule, Stripe, Sarvam
├── InnovationStack     — Innovation API, maintenance, routing, economic metrics
├── IntelligenceStack   — Full wiring: hazards + maintenance + device registry + frames bucket
│   (second pass)
└── EnterpriseStack     — Cognito UserPool, enterprise API, token burn + rewards distributor
    VisualizationStack  — Amazon Location Service placeholder (Phase 6)
```

### Stack → Resources

| CDK Stack | Key Resources Provisioned |
|---|---|
| **TrustStack** | `LedgerTable` (PK: `ledgerId`, SK: `timestamp`, DynamoDB Stream) |
| **SessionStack** | `SessionFilesTable`, `LedgerEntriesTable`; Session CRUD Lambda, GeohashResolver Lambda, HashChainValidator Lambda, PlacesSearch Lambda; Session API Gateway |
| **IngestionStack** | `HazardsTable` (+ `status-timestamp-index`, `h3-hazardtype-index` GSIs), `DeviceRegistryTable`, `PiDeviceRegistryTable`, `DeviceBindingsTable`, `VigiaAttestationLog`, `HazardFramesBucket` (S3, 30-day lifecycle); ValidatorFn, RegisterDeviceFn, ClaimDeviceFn, AttestationFn, StripePayoutFn, SarvamProxyFn, LedgerGetterFn, TracesGetterFn, HazardsGetterFn; IoT Topic Rule `vigia_hazard_attest`; IoT Device Policy `vigia-pi-device-policy`; Telemetry API Gateway; Secrets Manager refs (`vigia/stripe-secret-key`, `vigia/stripe-publishable-key`, `vigia/sarvam-api-key`) |
| **IntelligenceStack** | `CooldownTable`, `AgentTracesTable` (+ `HazardIdIndex` GSI), `RewardsLedgerTable`; OrchestratorFn (EventBridge Pipe source), SlashNodeFn, VerifyHazardSyncFn, RewardsBalanceFn, BedrockRouterFn (Python), NetworkIntelligenceFn (Python), MaintenanceLogisticsFn (Python), UrbanPlannerFn (Python + Step Functions proxy); Step Functions Express State Machine (`UrbanPlannerStateMachine`); Amazon Location Service Geofence Collection + Route Calculator; OrchestratorDLQ, SlashNodeDLQ (SQS); EventBridge Pipe `HazardsToOrchestratorPipe` (INSERT-only filter); EventBridge Pipe `VerifiedHazardsToMaintenancePipe` (MODIFY+VERIFIED filter) |
| **InnovationStack** | `AgentTracesTable`, `MaintenanceQueueTable` (+ `GeohashIndex`, `StatusIndex` GSIs), `EconomicMetricsTable`; RoutingAgentBranchFn, AgentTraceStreamerFn, MaintenanceReportHandlerFn, MaintenanceQueueQueryFn, EconomicMetricsQueryFn; Innovation API Gateway |
| **EnterpriseStack** | Cognito `EnterpriseUserPool` + Client; `EnterpriseUsersTable` (+ `apiKey-index` GSI), `BurnHistoryTable` (DynamoDB Stream); EnterpriseRegisterFn, EnterpriseLoginFn, EnterpriseBurnFn, EnterpriseMeFn, RewardsDistributorFn (stream trigger); Enterprise API Gateway with Cognito authorizer |
| **VisualizationStack** | Placeholder (Amazon Location Service — Phase 6) |

---

## Request Flows

### 1. Pi Hardware Attestation (MQTT path)

```
Pi ATECC608A → MQTT TLS publish → vigia/attest/<device_id>/hazard
  → IoT Topic Rule (SQL: encode + topic() + timestamp())
  → AttestationFn invoked by IoT Core
      1. Base64 decode → MsgPack decode (version 1 schema)
      2. Reconstruct EtHashInput (96-byte struct: device_id[16] + mcu_ts[8] +
         seq[4] + quaternion[16] + accel[12] + imu_cal[4] + lat/lon[16] +
         alt/speed/course[12] + gps_fix[4] + hdop[4])
      3. SHA-256(EtHashInput) → compare to et_hash in payload
      4. ECDSA P-256 prehashed verify via @noble/curves (sig from ATECC608A)
      5. DynamoDB conditional UPDATE on PiDeviceRegistryTable.last_seq
         (ConditionExpression: attribute_not_exists(last_seq) OR last_seq < :seq)
      6. H3 res-10 latLngToCell → query h3-hazardtype-index (24h dedup window)
         → UPDATE existing or PUT new hazard in HazardsTable
      7. PUT to VigiaAttestationLog (TTL 90 days)
```

### 2. Mobile Hazard Ingest + Verification

```
Android app → POST /telemetry (JSON + base64 frame optional)
  → ValidatorFn
      1. Input validation (hazardType, lat, lon, confidence, timestamp bounds)
      2. Timestamp freshness check (±10 min replay window)
      3. If frame_base64: SHA-256(frame) → include in signed message
      4. Ed25519 verify: VIGIA:<type>:<lat>:<lon>:<ts>:<conf>[:<sha256>]
         via nacl.sign.detached.verify (tweetnacl)
      5. DeviceRegistryTable lookup (fail-closed + blacklist check)
      6. ngeohash.encode(lat, lon, 7) → hazardId = geohash#timestamp
      7. If frame: PUT to S3 (frames/<geohash>/<timestamp>.jpg)
      8. PUT to HazardsTable status=PENDING, s3_key, ttl=30d
  → DynamoDB Stream INSERT → EventBridge Pipe (INSERT-only filter, batch 10)
  → OrchestratorFn (async, FIRE_AND_FORGET)
      [98% fast path]
        ONNX confidence ≥ 0.65 → VERIFIED, else REJECTED
        tryCreditReward (TransactWrite: cooldown + balance + ledger)
      [2% VLM path]
        S3 GetObject (frame) → Bedrock ConverseCommand (amazon.nova-lite-v1:0)
        → VLM confidence + reasoning
        VLM < 0.1 → async SlashNodeFn (Solana stake slash + DynamoDB blacklist)
        → InvokeAgentCommand (TAWWC3SQ0L) with ReAct: query_hazards + calculate_score
        → score ≥ 65 → VERIFIED; tryCreditReward; submitHazardToChain (Solana)
```

### 3. Reward Credit (atomic dedup)

```
OrchestratorFn / VerifyHazardSyncFn
  → tryCreditReward(wallet, geohash, hazardId, createdAt)
      DynamoDB TransactWrite (3 items):
        [1] PUT CooldownTable: rwd#<wallet>#<geohash> (30-day TTL)
            ConditionExpression: attribute_not_exists(cooldownKey)
        [2] UPDATE RewardsLedgerTable: ADD pending_balance 1e18, total_earned 1e18
        [3] PUT LedgerTable: ledger entry with SHA-256 currentHash
      On TransactionCanceledException → already rewarded in window, skip
```

### 4. Stripe Fiat Payout

```
Mobile wallet → POST /stripe/onboard-session (+ wallet ownership proof headers)
  → StripePayoutFn
      1. Verify X-Wallet-Signature: Ed25519 over "VIGIA-BALANCE:<wallet>:<tsMs>"
         (5-min freshness window, same mechanism as rewards-balance)
      2. stripe.accounts.create({ type: 'express' })
      3. stripe.accountLinks.create({ type: 'account_onboarding' })
      4. UPDATE RewardsLedgerTable: SET stripe_account_id

→ POST /stripe/payout-session
      1. Wallet ownership proof (same)
      2. GET RewardsLedgerTable → pending_balance
      3. stripe.paymentIntents.create (amount = pendingMicro/1e6 * VGA_TO_USD_CENTS,
         transfer_data.destination = stripeAccountId)

→ POST /stripe/financial-session
      stripe.financialConnections.sessions.create (bank-account linking)
```

### 5. Sarvam AI Voice Proxy

```
Mobile (with Cognito JWT) → POST /sarvam-proxy/stt (multipart/form-data WAV)
  → SarvamProxyFn
      Forward raw body to https://api.sarvam.ai/speech-to-text
      Header: API-Subscription-Key: <SARVAM_API_KEY from Secrets Manager>
      Return transcript JSON

→ POST /sarvam-proxy/tts (JSON { text, target_language_code, speaker, pitch, pace })
  → SarvamProxyFn
      POST to https://api.sarvam.ai/text-to-speech
      Return audio/wav bytes (base64 in JSON)
```

### 6. VLM Orchestration (Bedrock + Step Functions)

```
Bedrock Agent (TAWWC3SQ0L) action groups:
  hazardVerification  → BedrockRouterFn (Python)
      query_hazards(geohash, radius) → HazardsTable query
      calculate_score(confidence, similarReports) → weighted composite score
  networkIntelligence → NetworkIntelligenceFn (Python)
      Coverage gap analysis across HazardsTable
  maintenanceLogistics → MaintenanceLogisticsFn (Python)
      Repair queue + cost estimation from MaintenanceQueueTable
  urbanPlanner        → UrbanPlannerFn (Python) → Step Functions ExecuteStateMachine
      State Machine (Express):
        GenerateBezierPathFn → CalculateLandCostFn → CheckZoneRegulationsFn
        Location Service: BatchEvaluateGeofences, CalculateRoute
```

---

## Lambda Functions

| Function | Trigger | Purpose | Key Resources |
|---|---|---|---|
| **ValidatorFn** | POST /telemetry (API GW) | Ed25519 verify mobile submissions, write PENDING to HazardsTable, upload frame to S3 | HazardsTable (W), DeviceRegistryTable (R), HazardFramesBucket (W) |
| **AttestationFn** | IoT Core topic rule | ECDSA P-256 hardware attestation for Pi MQTT events; 96-byte EtHashInput + SHA-256 + anti-replay | PiDeviceRegistryTable (RW), HazardsTable (RW), VigiaAttestationLog (W) |
| **OrchestratorFn** | DynamoDB Stream (EventBridge Pipe, INSERT) | 98% fast-path ONNX score; 2% VLM + Bedrock ReAct; atomic reward credit; Solana submit | HazardsTable (RW), CooldownTable (RW), TracesTable (W), RewardsLedgerTable (W), LedgerTable (W), HazardFramesBucket (R), Bedrock Nova Lite, Bedrock Agent TAWWC3SQ0L, SlashNodeFn (async invoke), Solana devnet |
| **RegisterDeviceFn** | POST /register-device | Ed25519 proof-of-possession: verify `VIGIA-REGISTER:<device_address>` before writing to DeviceRegistryTable | DeviceRegistryTable (W) |
| **ClaimDeviceFn** | POST /claim-device | 1:1 hardware ↔ wallet binding with bidirectional exclusivity via conditional PutItem | DeviceBindingsTable (RW, GSI: wallet-pubkey-index) |
| **VerifyHazardSyncFn** | POST /verify-hazard-sync | Synchronous Bedrock Agent path (ECDSA verify + H3 dedup + reward credit + trace store) for interactive demo | TracesTable (W), HazardsTable (W), LedgerTable (W), RewardsLedgerTable (W), DeviceRegistryTable (R), Bedrock Agent TAWWC3SQ0L |
| **RewardsBalanceFn** | GET /rewards-balance | Read wallet balance; requires Ed25519 ownership proof (`VIGIA-BALANCE:<wallet>:<tsMs>`, 5-min window) | RewardsLedgerTable (R) |
| **StripePayoutFn** | POST /stripe/{onboard,payout,financial}-session | Stripe Connect Express onboarding, PaymentIntent payout, Financial Connections session | RewardsLedgerTable (RW), Secrets Manager (`vigia/stripe-secret-key`, `vigia/stripe-publishable-key`) |
| **SarvamProxyFn** | POST /sarvam-proxy/{stt,tts} | Server-side proxy for Sarvam AI STT/TTS; keeps API key off mobile APK | Secrets Manager (`vigia/sarvam-api-key`) |
| **SlashNodeFn** | Async invoke from OrchestratorFn | On-chain slash of fraudulent node; DynamoDB blacklist write | Solana devnet (Anchor program), Secrets Manager (Solana authority keypair), DeviceRegistryTable (W) |
| **DiffAnalysisFn** | POST via frontend API route | Temporal road infrastructure diff analysis via Bedrock Agent (Nova Lite) | Bedrock Agent (AGENT_ID env) |
| **AgentChatFn** | POST /api/agent/chat (Next.js route) | Pass-through Bedrock Agent chat with ReAct trace streaming | Bedrock Agent TAWWC3SQ0L |
| **BedrockRouterFn** | Bedrock Agent action group | Python: `query_hazards` + `calculate_score` action group implementation | HazardsTable (R) |
| **NetworkIntelligenceFn** | Bedrock Agent action group | Python: network coverage gap analysis | HazardsTable (R) |
| **MaintenanceLogisticsFn** | Bedrock Agent action group | Python: repair queue prioritization + cost estimation | HazardsTable (R), MaintenanceQueueTable (R) |
| **UrbanPlannerFn** | Bedrock Agent action group | Python: route calculation + Step Functions proxy for Bezier path + land cost + zone check | HazardsTable (R), EconomicMetricsTable (R), Location Service, Step Functions State Machine |
| **AgentTraceStreamerFn** | GET /agent-traces/stream | SSE: write mock ReAct traces to DynamoDB (real Bedrock streaming pending) | AgentTracesTable (W) |
| **RoutingAgentBranchFn** | POST /routing-agent/branch | Route impact computation per hazard set (SHA-256 in-memory cache) | — |
| **MaintenanceReportHandlerFn** | POST /maintenance/report | Create/update maintenance queue entries; compute repair cost by hazard type | MaintenanceQueueTable (RW), EconomicMetricsTable (RW) |
| **MaintenanceQueueQueryFn** | GET /maintenance/queue | Query by status (StatusIndex GSI) or geohash (GeohashIndex GSI) | MaintenanceQueueTable (R) |
| **EconomicMetricsQueryFn** | GET /economic/metrics | Query ROI + cost aggregates per sessionId | EconomicMetricsTable (R) |
| **SessionCRUDFn** | /sessions CRUD | Map-as-a-File-System session create/read/update/delete | SessionFilesTable (RW), LedgerEntriesTable (W) |
| **GeohashResolverFn** | POST /geohash/resolve | Decode geohash → city/region via Amazon Location Service ReverseGeocode | Location Service (geo-places:ReverseGeocode) |
| **HashChainValidatorFn** | GET /sessions/{id}/validate | Verify SHA-256 ledger hash chain integrity for a session | LedgerEntriesTable (R) |
| **PlacesSearchFn** | POST /places/search | Amazon Location Service SearchText + ReverseGeocode | Location Service |
| **EnterpriseRegisterFn** | POST /enterprise/register | Cognito AdminCreateUser + AdminSetUserPassword | EnterpriseUsersTable (RW), Cognito UserPool |
| **EnterpriseLoginFn** | POST /enterprise/login | Cognito InitiateAuth | Cognito UserPool |
| **EnterpriseBurnFn** | POST /enterprise/burn (Cognito JWT) | Record $VIGIA token burn → BurnHistoryTable | BurnHistoryTable (RW) |
| **EnterpriseMeFn** | GET /enterprise/me (Cognito JWT) | Return enterprise user profile + API key | EnterpriseUsersTable (RW) |
| **RewardsDistributorFn** | BurnHistoryTable DynamoDB Stream | Distribute rewards on burn event | EnterpriseUsersTable (R), HazardsTable (R) |
| **LedgerGetterFn** | GET /ledger | Return latest 10 DePIN ledger entries | LedgerTable (R) |
| **HazardsGetterFn** | GET /hazards | Scan latest 100 hazards sorted by timestamp | HazardsTable (R) |
| **TracesGetterFn** | GET /traces | Return latest Bedrock ReAct traces | TracesTable (R) |

---

## Data Model

| Table | Partition Key | Sort Key | GSIs | Purpose |
|---|---|---|---|---|
| **HazardsTable** | `geohash` (S) | `timestamp` (S) | `status-timestamp-index` (status/timestamp); `h3-hazardtype-index` (h3_index/hazardType) | Central store for all hazards (mobile PENDING + hardware-attested); fields: `hazardType`, `lat`, `lon`, `confidence`, `h3_index`, `severity_score`, `observation_count`, `status` (PENDING/VERIFIED/REJECTED/UNVERIFIED_VLM_FAILED), `driverWalletAddress`, `s3_key`, `ttl` (30 days) |
| **PiDeviceRegistryTable** | `device_id` (S) | — | — | Pi hardware units: `cert_pem` (X.509 PEM), `last_seq` (anti-replay watermark), `last_seen`; removalPolicy=RETAIN |
| **DeviceRegistryTable** | `device_address` (S) | — | — | Mobile wallet registrations (base58 Ed25519 pubkey); `blacklisted` flag; `registered_at` |
| **DeviceBindingsTable** | `device_id` (S) | — | `wallet-pubkey-index` (wallet_pubkey) | 1:1 hardware ↔ wallet binding; `wallet_pubkey`, `claimed_at`; removalPolicy=RETAIN |
| **VigiaAttestationLog** | `pk` (S) — `device_id#seq` | — | — | Append-only verified Pi event log; `rri_score`, `iss_score`, `lat`, `lon`; TTL 90 days |
| **TracesTable** | `traceId` (S) | — | `HazardIdIndex` (hazardId/createdAt) | Bedrock ReAct reasoning traces; `vlm_reasoning`, `vlm_confidence`, `onnx_confidence`, `react_steps`, `total_score`, `verdict`; TTL 7 days |
| **LedgerTable** | `ledgerId` (S) | `timestamp` (S) | — | DePIN hash-chain ledger; `contributorId`, `hazardId`, `credits`, `previousHash`, `currentHash` (SHA-256) |
| **RewardsLedgerTable** | `wallet_address` (S) | — | — | Off-chain pending $VIGIA balance; `pending_balance` (wei BigInt), `total_earned`, `total_claimed`, `nonce`, `stripe_account_id` |
| **CooldownTable** | `cooldownKey` (S) | — | — | Two namespaces: `proc#<hazardId>` (processing dedup, 30-sec TTL) and `rwd#<wallet>#<geohash>` (reward dedup, 30-day TTL) |
| **MaintenanceQueueTable** | `reportId` (S) | `reportedAt` (N) | `GeohashIndex`; `StatusIndex` | Repair reports: `hazardId`, `type`, `severity`, `estimatedCost`, `status` (PENDING/IN_PROGRESS/COMPLETED/REJECTED) |
| **EconomicMetricsTable** | `sessionId` (S) | `timestamp` (N) | — | Session-scoped ROI: `totalHazardsDetected`, `totalEstimatedRepairCost`, `totalPreventedDamageCost` |
| **EnterpriseUsersTable** | `userId` (S) | — | `apiKey-index` (apiKey) | Enterprise users; Cognito-linked; `apiKey` for Data Credit API access |
| **BurnHistoryTable** | `userId` (S) | `timestamp` (S) | — | $VIGIA burn events; DynamoDB Stream triggers RewardsDistributorFn |
| **SessionFilesTable** | `userId` (S) | `sessionId` (S) | `geohash7-timestamp-index`; `status-timestamp-index` | MFS session metadata; removalPolicy=RETAIN |
| **LedgerEntriesTable** | `ledgerId` (S) | `timestamp` (S) | — | MFS session ledger with hash chain; `previousHash`, `currentHash`; removalPolicy=RETAIN |
| **AgentTracesTable** (Innovation) | `traceId` (S) | `timestamp` (N) | `GeohashIndex` (geohash/timestamp) | Innovation stack agent traces; `geohash`, `contributorId`, `steps`; TTL 7 days |
| **AgentRateLimitTable** | `pk` (S) | — | — | IP-level rate limiting (Next.js API routes); TTL-keyed entries |

---

## Security Model

| Mechanism | Where | Implementation |
|---|---|---|
| **ECDSA P-256 hardware attestation** | AttestationFn | 96-byte `EtHashInput` struct reconstructed; SHA-256 verified against `et_hash`; raw R‖S signature from ATECC608A verified via `@noble/curves` p256 with `prehash:false, lowS:false` |
| **Ed25519 mobile signature** | ValidatorFn | `nacl.sign.detached.verify(msg, sigBytes, pubkeyBytes)` (tweetnacl); message: `VIGIA:<type>:<lat>:<lon>:<ts>:<conf>[:<frame_sha256>]`; 10-min freshness window |
| **Ed25519 proof-of-possession** | RegisterDeviceFn | Client signs `VIGIA-REGISTER:<device_address>`; prevents registering wallets the caller does not control |
| **Wallet ownership proof** | RewardsBalanceFn, StripePayoutFn | Client signs `VIGIA-BALANCE:<wallet>:<tsMs>`; verified with `nacl.sign.detached.verify`; 5-min freshness window prevents replay |
| **Anti-replay sequence watermark** | AttestationFn | `ConditionExpression: attribute_not_exists(last_seq) OR last_seq < :seq` on PiDeviceRegistryTable; advances only after valid ECDSA verify — prevents poisoned-watermark DoS |
| **H3 geo-deduplication** | AttestationFn (res-10), OrchestratorFn / VerifyHazardSyncFn (res-9) | `latLngToCell(lat, lon, resolution)` — same physical cell submits only one reward per 30-day window; prevents Sybil farming by GPS spoofing at sub-cell granularity |
| **Atomic reward credit (TransactWrite)** | OrchestratorFn | 3-item DynamoDB transaction (cooldown lock + balance ADD + ledger PUT); `ConditionalCheckFailed` on lock = already rewarded; no read-then-write race possible |
| **VLM fail-closed quarantine** | OrchestratorFn | Any failure in S3 fetch or Bedrock Converse → status=`UNVERIFIED_VLM_FAILED`, no reward; blocks reward farming via VLM unavailability |
| **Sybil slashing** | OrchestratorFn → SlashNodeFn | VLM confidence < 0.1 → async `InvokeCommand` on SlashNodeFn → Solana Anchor `slash_node` ix + DynamoDB `blacklisted=true` |
| **Device blacklist enforcement** | ValidatorFn | `Item.blacklisted === true` → 403 `DEVICE_BLACKLISTED`; slashed devices cannot re-submit |
| **IoT Core device-scoped policy** | IngestionStack CDK | `iot:Publish` resource scoped to `vigia/attest/${iot:ClientId}/hazard` — each Pi can only publish to its own topic |
| **Secrets Manager** | IngestionStack, IntelligenceStack | Stripe keys (`vigia/stripe-secret-key`, `vigia/stripe-publishable-key`), Sarvam key (`vigia/sarvam-api-key`), Solana authority keypair (`vigia-solana-authority-ro47l5`) — never in Lambda environment variables at source |
| **Cognito JWT authorizer** | EnterpriseStack | `EnterpriseAuthorizer` protects `/enterprise/me` and `/enterprise/burn`; IAM `authorizationType: COGNITO` |
| **Probabilistic VLM sampling** | OrchestratorFn | `VLM_SAMPLE_RATE` env var (default 0.02); 98% events bypass the VLM to keep cost linear; spoofs are still caught at 2% sample rate because each slot uses ONNX confidence as the deterministic gating signal |

---

## Tech Stack

| Layer | Technology | Version (from package.json) |
|---|---|---|
| Infrastructure-as-Code | AWS CDK | `2.170.0` |
| Lambda runtime | Node.js | `20.x` |
| Lambda runtime (action groups) | Python | `3.12` |
| Language | TypeScript | `5.3.3` |
| AWS SDK | `@aws-sdk/*` | `^3.700.0` – `^3.1030.0` |
| Cryptography | `@noble/curves` (ECDSA P-256) | `^2.2.0` |
| Cryptography | `tweetnacl` (Ed25519) | `^1.0.3` |
| Binary encoding | `@msgpack/msgpack` | `^3.1.3` |
| Base58 codec | `bs58` | `^5.0.0` |
| Geospatial indexing | `h3-js` | `^4.4.0` |
| Geohash encoding | `ngeohash` | `^0.6.3` |
| Blockchain | `@solana/web3.js`, `@solana/spl-token` | `^1.95.0`, `^0.4.14` |
| Fiat payments | `stripe` | `^22.2.2` |
| Build / bundler | `esbuild` (via `aws-lambda-nodejs`) | `^0.28.0` |
| Test runner | `vitest` | `^4.1.4` |
| Frontend | Next.js | (packages/frontend) |

---

## Getting Started

### Prerequisites

- Node.js 20+, npm 10+
- AWS CLI configured (`aws configure`)
- AWS CDK CLI: `npm install -g aws-cdk@2.170.0`
- The following Secrets Manager secrets must exist in your target region before deploy:

| Secret name | Contents |
|---|---|
| `vigia/stripe-secret-key` | Stripe secret key (`sk_test_…` or `sk_live_…`) |
| `vigia/stripe-publishable-key` | Stripe publishable key (`pk_test_…` or `pk_live_…`) |
| `vigia/sarvam-api-key` | Sarvam AI API subscription key |
| `vigia-solana-authority-ro47l5` | `{ "privateKey": [...] }` — Solana authority keypair |

- The following SSM Parameter Store parameters must exist:

| Parameter | Value |
|---|---|
| `/vigia/KMS_KEY_ID` | KMS key ID for VerifyHazardSyncFn ECDSA signing |
| `/vigia/VIGIA_CONTRACT_ADDRESS` | Deployed VIGIA smart contract address |

### Deploy

```bash
# Install all workspaces
npm install

# Bootstrap CDK (first time only)
cd packages/infrastructure
cdk bootstrap aws://YOUR_ACCOUNT_ID/us-east-1

# Synthesize to validate
npm run cdk:synth

# Deploy all stacks
npm run cdk:deploy
```

### Environment Variables (set before deploy if overriding defaults)

| Variable | Default | Purpose |
|---|---|---|
| `VLM_SAMPLE_RATE` | `0.02` | Fraction of hazard events routed through Bedrock VLM (0.0–1.0) |
| `BEDROCK_AGENT_ID` | `TAWWC3SQ0L` | Bedrock Agent ID |
| `BEDROCK_AGENT_ALIAS_ID` | `TSTALIASID` | Bedrock Agent Alias ID |
| `SOLANA_RPC_URL` | `https://api.devnet.solana.com` | Solana cluster endpoint |
| `SOLANA_PROGRAM_ID` | `BKaxbk73bCY8xRuphpkTESWjaJofdnBpuc2T193f3nkW` | Anchor program address |
| `VGA_TO_USD_CENTS` | `100` | Exchange rate for Stripe payout (1 VGA = 100 USD cents = $1.00) |

### Run Tests

```bash
npm run test
```

---

## Project Structure

```
vigia-amazon/
├── packages/
│   ├── backend/
│   │   ├── functions/                   # Lambda handlers
│   │   │   ├── attestation/             # IoT Core ECDSA P-256 attestation
│   │   │   ├── agent-chat/              # Bedrock Agent chat pass-through
│   │   │   ├── agent-trace-streamer/    # SSE ReAct trace streaming
│   │   │   ├── claim-device/            # 1:1 hardware/wallet binding
│   │   │   ├── diff-analysis/           # Temporal diff via Bedrock Agent
│   │   │   ├── economic-metrics-query/  # ROI + cost query
│   │   │   ├── maintenance-queue-query/ # Repair queue read
│   │   │   ├── maintenance-report-handler/ # Repair report write
│   │   │   ├── register-device/         # Ed25519 proof-of-possession registration
│   │   │   ├── rewards-balance/         # Wallet balance (ownership proof gated)
│   │   │   ├── routing-agent-branch/    # Route impact computation
│   │   │   ├── sarvam-proxy/            # Sarvam STT/TTS API proxy
│   │   │   ├── slash-node/              # Solana on-chain slash
│   │   │   ├── stripe-payout/           # Stripe Connect + PaymentIntent
│   │   │   └── verify-hazard-sync/      # Synchronous Bedrock verify (demo)
│   │   ├── src/
│   │   │   ├── actions/                 # Python Bedrock action group handlers
│   │   │   │   └── step-functions/      # Step Functions micro-Lambdas
│   │   │   ├── geohash/resolver.ts      # Geohash → city (Location Service)
│   │   │   ├── hazards/get-hazards.ts   # GET /hazards handler
│   │   │   ├── ledger/                  # Ledger read + hash chain validator
│   │   │   ├── orchestrator/index.ts    # Core VLM + ReAct orchestration
│   │   │   ├── places/search.ts         # Places search handler
│   │   │   ├── sessions/handler.ts      # MFS session CRUD
│   │   │   ├── solana/                  # Solana authority, PDA, instructions
│   │   │   ├── traces/                  # Trace read handlers
│   │   │   ├── validator/index.ts       # Ed25519 mobile telemetry ingest
│   │   │   └── workflows/              # Step Functions ASL definitions
│   │   └── lib/costCalculator.ts        # Repair cost + ROI calculations
│   ├── infrastructure/
│   │   ├── bin/vigia.ts                 # CDK app entry point
│   │   └── lib/
│   │       ├── vigia-stack.ts           # Root stack (wires all sub-stacks)
│   │       ├── constructs/bedrock-agent.ts # Bedrock action group IAM wiring
│   │       └── stacks/
│   │           ├── ingestion-stack.ts   # Telemetry API + IoT Core + Stripe + Sarvam
│   │           ├── intelligence-stack.ts # Orchestrator + Bedrock + EventBridge Pipes
│   │           ├── trust-stack.ts       # DePIN ledger table
│   │           ├── innovation-stack.ts  # Innovation API + maintenance + routing
│   │           ├── enterprise-stack.ts  # Cognito + enterprise API + token burn
│   │           ├── session-stack.ts     # MFS session API
│   │           └── visualization-stack.ts # Location Service (Phase 6)
│   ├── frontend/                        # Next.js IDE (packages/frontend)
│   ├── shared/src/                      # Shared types (agentTrace, diffCompute, mapFile)
│   ├── contracts/                       # Solidity VIGIA_BME.sol + Hardhat
│   └── programs/vigia_protocol/        # Anchor (Rust) Solana program
├── vigia_protocol/                      # Anchor workspace
├── wiki/                                # Obsidian vault (this repo)
└── archive/                             # Historical design docs
```

---

## About the Developer

**Tom Mathew** (National Institute of Technology, Rourkela) and Team (Ben Biju & Shreeram Balasubramanian)

Built as part of the VIGIA road intelligence platform — combining edge AI on Raspberry Pi, serverless AWS attestation, and on-chain settlement on Solana.

---

## License

MIT License — Copyright © 2026 Tom Mathew

---

## Resources

- [VIGIA Edge Node (vigia-raspi)](https://github.com/BlueWaves-afk/vigia-raspi) — Raspberry Pi firmware, BLE transport, ATECC608A attestation
- [VIGIA Android App (vigia2)](https://github.com/BlueWaves-afk/vigia2) — Kotlin/Compose mobile app
- [Amazon Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [AWS IoT Core Documentation](https://docs.aws.amazon.com/iot/)
- [H3 Geospatial Indexing](https://h3geo.org/)
- [Solana Anchor Framework](https://www.anchor-lang.com/)
- [Sarvam AI](https://www.sarvam.ai/)
- [Stripe Connect](https://stripe.com/connect)
