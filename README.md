<img width="3780" height="1890" alt="image" src="https://github.com/user-attachments/assets/71c5ec70-44f0-41f5-9fad-b8ebb12b6ed1" />

<div align="center">
  <h1>VIGIA Road Intelligence IDE</h1>
  <p><strong>The operating system for road infrastructure</strong></p>
  <p><em>Real-time hazard detection, AI-verified condition data, route intelligence, and predictive maintenance — powered by a DePIN edge network and settled on Solana.</em></p>

  <p>
    <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/License-Apache--2.0-blue.svg"></a>
    <img alt="Solana" src="https://img.shields.io/badge/Settlement-Solana-9945FF?logo=solana&logoColor=white">
    <img alt="AWS" src="https://img.shields.io/badge/Compute-AWS%20Serverless-FF9900?logo=amazonaws&logoColor=white">
    <img alt="AI" src="https://img.shields.io/badge/AI-Edge%20ONNX%20%2B%20Bedrock-232F3E">
  </p>
</div>

---

## The Problem

Road infrastructure teams operate blind. Municipalities spend **$89B/year** on road maintenance globally, yet:
- **30% of repairs are reactive** — fixing damage that could have been prevented with early detection
- **Condition surveys cost $2,000–$10,000/lane-mile** using LiDAR vehicles that cover a city once every 2-5 years
- **No single platform** unifies detection, verification, routing, and maintenance planning

## The Product

VIGIA Road Intelligence IDE is a web-based command center that gives infrastructure teams **continuous, AI-verified road condition intelligence** at 99% lower cost than traditional surveys.

**For fleet operators**: Real-time hazard alerts + safest route computation  
**For municipalities**: City-wide coverage maps + predictive maintenance queues + cost estimation  
**For insurers**: Verified road condition data for risk modeling + claims validation

**The cost advantage**: A city with 10,000 lane-miles spends $20M+ on periodic LiDAR surveys. VIGIA delivers continuous coverage for $37,200/year (10,000 crowdsourced nodes × $0.31/month cloud cost). Data is AI-verified and cryptographically signed — more trustworthy than manual inspections.

---

## What the IDE Does

### Detection Console
Upload dashcam footage or connect a live feed. The ONNX model detects hazards at 60ms/frame in-browser. Every detection is Ed25519-signed and submitted to the verification pipeline. *(Browser-based demo — production nodes run on [Raspberry Pi 4](https://github.com/BlueWaves-afk/vigia-raspi) with headless inference.)*

### Verification Pipeline
Each hazard passes through a Vision Language Model (image analysis) and a Bedrock ReAct Agent (historical context + scoring). Full reasoning traces are visible — you see exactly why a hazard was verified or rejected.

### Network Surveillance
Live map of all active edge nodes and their coverage areas. See which roads have been surveyed today, identify coverage gaps, and track network health.

### Route Intelligence
Pin two points on the map → get fastest vs safest route comparison. Hazard-aware routing powered by AWS Location Service with real-time road condition overlay.

### Infrastructure Diffs
Temporal auditing: compare road conditions between any two time periods. Visual markers show new hazards (red), fixed hazards (green), and worsened conditions (orange).

### Maintenance Queue
AI-prioritized repair queue with cost estimation ($500/pothole, $5K/accident). ROI calculations for repair vs ignore decisions. Export to municipal work order systems.

### Enterprise Console
$VIGIA token exchange, Data Credit balance, API usage metrics, burn history. Municipalities purchase Data Credits to access the API without holding volatile crypto.

---

## How Data Flows

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Edge Nodes (Dashcams / Pi / Mobile)                                    │
│  YOLOv26 ONNX (6MB, 60ms) → Ed25519 sign → POST /telemetry            │
└────────────────────────────────┬────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  AWS Serverless Verification                                            │
│  Validator → S3 Frame → Nova Lite VLM → Bedrock Agent (ReAct) → Score  │
└────────────────────────────────┬────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  Solana On-Chain Settlement                                             │
│  H3 PDA dedup → mint_to $VIGIA → Discovery 10 / Validation 0.1        │
└────────────────────────────────┬────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  VIGIA Road Intelligence IDE                                            │
│  Maps · Diffs · Routes · Maintenance Queue · Enterprise Console         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Key Metrics

| Metric | Value |
|---|---|
| Cloud cost per node/month | **$0.31** |
| Edge inference latency | **60ms** (ONNX, browser Web Worker) |
| VLM verification | **~2s** (Nova Lite, $0.001/hazard) |
| On-chain settlement | **~400ms** (Solana, $0.000005/tx) |
| Deduplication | **H3 res-9 PDA** (~12m cells, protocol-level) |
| Scaling | **Linear** — constant per-node cost at any scale |

---

## Market & Unit Economics

### Target Market

| Segment | TAM | VIGIA Value Prop |
|---|---|---|
| Municipal road maintenance | $89B/year | Replace periodic surveys with continuous monitoring |
| Fleet management | $30B/year | Real-time hazard alerts, route optimization |
| Insurance (auto) | $800B premiums/year | Verified road condition data for risk pricing |
| Autonomous vehicles | $60B/year (mapping) | HD road condition layer for path planning |

### Cost Comparison

| Method | Cost per lane-mile | Frequency | Data freshness |
|---|---|---|---|
| LiDAR survey vehicle | $2,000–$10,000 | Every 2-5 years | Stale |
| Manual inspection | $500–$1,000 | Annual | Stale |
| **VIGIA (crowdsourced)** | **$3.72** | **Continuous** | **Real-time** |

### Per Node (10 hazards/day, 30 days)

| Service | Cost |
|---|---|
| Bedrock VLM (image tiles) | $0.24 |
| Bedrock Agent (text) | $0.05 |
| Lambda compute | $0.01 |
| S3 + DynamoDB | $0.005 |
| API Gateway | $0.001 |
| **Total** | **$0.31/month** |

### At Scale

| Nodes | Monthly Cost | Per-Node |
|---|---|---|
| 1,000 | $310 | $0.31 |
| 10,000 | $3,100 | $0.31 |
| 100,000 | $31,000 | $0.31 |

---

## Architecture

### Edge Intelligence
- **YOLOv26-FP32** ONNX model runs in browser Web Worker (6 MB, zero cloud compute)
- **Ed25519** cryptographic signing on every payload (device identity)
- **5 FPS** frame extraction, 99% filtered at edge — only high-confidence detections sent to cloud
- **Tested on Raspberry Pi 4 (4GB)** — production edge node running headless inference → [vigia-raspi](https://github.com/BlueWaves-afk/vigia-raspi)

### Serverless Verification (AWS)
- **API Gateway → Validator Lambda** — Ed25519 signature verification + device registry check
- **S3 Pointer Pattern** — frame uploaded, orchestrator fetches asynchronously
- **Amazon Bedrock Nova Lite** — Vision Language Model confirms hazard is real (image + reasoning)
- **Bedrock Agent (ReAct)** — multi-step verification with tool calls (query_hazards, calculate_score)
- **DynamoDB Streams → EventBridge Pipes** — event-driven, INSERT-only filtering

### On-Chain Settlement (Solana)
- **Anchor Program** — `BKaxbk73bCY8xRuphpkTESWjaJofdnBpuc2T193f3nkW`
- **H3 PDA Model** — `["hazard", h3_index, epoch_day]` seeds = protocol-level deduplication
- **BME Tokenomics** — $VIGIA minted on every verified hazard (uncapped supply, enterprise burn = deflation)
- **State Compression** — validation events appended to global Merkle tree ($0.000005/event)
- **Sponsored Staking** — authority stakes on behalf of new nodes (zero-friction onboarding)
- **Clock Drift Guard** — on-chain epoch verification prevents future-date attacks

### Security
- **Fail-closed VLM quarantine** — any AI failure = no reward, no on-chain write
- **Slashing** — VLM confidence < 0.1 triggers stake burn + node blacklist
- **Rate limiting** — 5 queries/min, 30/hour per IP (server-enforced)
- **Zero PII** — contributor IDs are Ed25519 pubkeys, no personal data stored

---

## Tokenomics ($VIGIA)

| Event | Tokens Minted | Mechanism |
|---|---|---|
| Discovery (new H3 cell today) | **10 $VIGIA** | `initialize_hazard` → `mint_to` |
| Validation (confirm existing) | **0.1 $VIGIA** | `validate_hazard` → `mint_to` |
| Enterprise Data Credits | — (burn) | `burnForDataCredits` → deflationary |

**Supply**: Uncapped — grows with network activity  
**Deflation**: Enterprise burns create demand-side pressure  
**Equilibrium**: Mint rate (node activity) vs burn rate (enterprise consumption)

### Enterprise & Government Access (Data Credits)

Municipalities and insurers don't hold volatile crypto. They purchase **Data Credits** — a stable, non-transferable unit pegged to API calls:

1. Enterprise buys $VIGIA on open market (or receives from treasury grant)
2. Burns $VIGIA → receives Data Credits at a fixed rate (1 $VIGIA = 1,000 credits)
3. Data Credits are consumed per API call (hazard queries, route intelligence, coverage reports)

**Why this works for governments**: Data Credits are denominated in API calls, not token price. A city budgets "$50K/year for road data" → buys credits at whatever the current $VIGIA price is → gets the same number of API calls regardless of token volatility. The burn mechanic insulates enterprise users from price fluctuation while still creating deflationary pressure on the token supply.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Edge AI | ONNX Runtime Web, YOLOv26-FP32, Web Workers |
| Frontend | Next.js 16, React 19, TypeScript, MapLibre GL |
| Backend | AWS Lambda (Node.js 20 + Python 3.12), 33 functions |
| AI/ML | Amazon Bedrock (Nova Lite), ReAct Agent, 4 Action Groups |
| Blockchain | Solana (Anchor), SPL Token, State Compression |
| Infrastructure | AWS CDK, DynamoDB, S3, EventBridge Pipes, Step Functions |
| Crypto | Ed25519 (tweetnacl), H3 geospatial indexing |

---

## Roadmap

| Phase | Focus |
|---|---|
| **Now** | Devnet live, browser demo, 10 edge nodes |
| **Q3 2026** | Mobile SDK (iOS/Android), Raspberry Pi fleet, mainnet |
| **Q4 2026** | Enterprise API marketplace, multi-city deployment |
| **2027** | Autonomous maintenance dispatch, insurance integrations |

---

## Contributors
<a href="https://github.com/BlueWaves-afk/vigia-amazon/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=BlueWaves-afk/vigia-amazon" />
</a>

## License

Apache License 2.0 — See [LICENSE](LICENSE)

---

## Contact

**Founder**: Tom Mathew  
**Email**: tom@vigia.network

---

<div align="center">
  <sub>Built with edge AI, serverless compute, and on-chain settlement.</sub>
</div>
