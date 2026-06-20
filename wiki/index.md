---
title: "VIGIA Cloud Pipeline — Map of Content"
type: hub
tags: [#decision, vigia]
source: README.md
related: ["[[ingestion-stack]]", "[[intelligence-stack]]", "[[trust-stack]]", "[[innovation-stack]]", "[[enterprise-stack]]", "[[session-stack]]"]
updated: 2026-06-20
---

# VIGIA Cloud Pipeline — Second Brain

> Serverless attestation, DePIN reward, and AI orchestration backend for the VIGIA edge node and mobile app.

This vault maps every Lambda, DynamoDB table, AWS managed service, CDK stack, external dependency, security mechanism, API route, and end-to-end data flow in the `vigia-amazon` AWS CDK monorepo.

---

## AWS Managed Services
- [[iot-core]] — MQTT broker receiving Pi hardware attestations
- [[api-gateway-telemetry]] — REST API: telemetry ingest + device management
- [[api-gateway-innovation]] — REST API: maintenance, routing, economic metrics
- [[api-gateway-session]] — REST API: Map-as-a-File-System session CRUD
- [[api-gateway-enterprise]] — REST API: enterprise auth, token burn
- [[eventbridge-pipes]] — INSERT-only filter from HazardsTable stream → OrchestratorFn
- [[step-functions-urban-planner]] — Express workflow: Bezier path + land cost + zone check
- [[bedrock-agent]] — ReAct agent (TAWWC3SQ0L) with 4 action groups
- [[bedrock-nova-lite]] — Amazon Nova Lite VLM (vision language model)
- [[sqs-orchestrator-dlq]] — Dead-letter queue for failed orchestrator invocations
- [[sqs-slash-dlq]] — Dead-letter queue for failed slash-node invocations
- [[sqs-maintenance-queue]] — Fan-out queue for VERIFIED hazards
- [[cognito-user-pool]] — Enterprise JWT authentication
- [[secrets-manager]] — Stripe keys, Sarvam key, Solana authority keypair
- [[location-service]] — Route calculator + geofence collection
- [[s3-frames-bucket]] — 30-day hazard frame store (S3 pointer pattern)

## Lambda Functions

### Ingestion Stack
- [[validator-fn]] — Ed25519 verify + PENDING write to HazardsTable
- [[attestation-fn]] — IoT Core MQTT, ECDSA P-256 hardware attestation
- [[register-device-fn]] — Ed25519 proof-of-possession device self-registration
- [[claim-device-fn]] — 1:1 hardware/wallet binding enforcement
- [[stripe-payout-fn]] — Stripe Connect Express + PaymentIntent payout
- [[sarvam-proxy-fn]] — Sarvam AI STT/TTS key proxy
- [[ledger-getter-fn]] — GET /ledger entries
- [[hazards-getter-fn]] — GET /hazards list
- [[traces-getter-fn]] — GET /traces latest traces

### Intelligence Stack
- [[orchestrator-fn]] — DynamoDB Stream → VLM (2%) + Bedrock Agent ReAct verify
- [[slash-node-fn]] — Slashes fraudulent nodes on-chain (Solana)
- [[verify-hazard-sync-fn]] — Synchronous Bedrock Agent path (interactive demo)
- [[rewards-balance-fn]] — Read-only wallet balance with ownership proof
- [[bedrock-router-fn]] — Python action group: query_hazards + calculate_score
- [[network-intelligence-fn]] — Python action group: network coverage analysis
- [[maintenance-logistics-fn]] — Python action group: repair queue logistics
- [[urban-planner-fn]] — Python action group: routes + Step Functions proxy
- [[diff-analysis-fn]] — Temporal road infrastructure diff via Bedrock Agent
- [[agent-chat-fn]] — Bedrock Agent chat pass-through

### Innovation Stack
- [[agent-trace-streamer-fn]] — SSE streaming of ReAct traces
- [[routing-agent-branch-fn]] — Route impact computation per hazard set
- [[maintenance-report-handler-fn]] — Create/update maintenance queue entries
- [[maintenance-queue-query-fn]] — Read maintenance queue (by status or geohash)
- [[economic-metrics-query-fn]] — Query ROI + repair cost metrics per session

### Session Stack
- [[session-crud-fn]] — Map-as-a-File-System session CRUD
- [[geohash-resolver-fn]] — Geohash → city/region via Location Service
- [[hash-chain-validator-fn]] — Verify ledger hash chain integrity
- [[places-search-fn]] — Amazon Location Service places search

### Enterprise Stack
- [[enterprise-register-fn]] — Cognito enterprise user registration
- [[enterprise-login-fn]] — Cognito auth flow
- [[enterprise-burn-fn]] — Burn $VIGIA tokens → Data Credits
- [[enterprise-me-fn]] — Enterprise user profile
- [[rewards-distributor-fn]] — BurnHistory stream trigger → distribute rewards

## DynamoDB Tables
- [[hazards-table]] — Central hazard store
- [[vigia-pi-device-registry]] — Pi hardware units (cert_pem, anti-replay seq)
- [[vigia-device-registry]] — Mobile wallet registrations
- [[device-bindings-table]] — 1:1 hardware ↔ wallet binding
- [[attestation-log-table]] — Append-only verified event log
- [[traces-table]] — Bedrock ReAct reasoning traces
- [[ledger-table]] — DePIN hash-chain ledger
- [[rewards-ledger-table]] — Off-chain pending $VIGIA balances per wallet
- [[cooldown-table]] — Processing dedup + 30-day reward dedup
- [[maintenance-queue-table]] — Repair reports with cost estimates
- [[economic-metrics-table]] — Session-scoped ROI + cost aggregates
- [[enterprise-users-table]] — Enterprise users + API key
- [[burn-history-table]] — $VIGIA burn events
- [[session-files-table]] — MFS session metadata
- [[ledger-entries-table]] — MFS session ledger hash chain
- [[agent-traces-table]] — Innovation stack agent traces
- [[agent-rate-limit-table]] — IP-level rate limiting

## Security Mechanisms
- [[ecdsa-p256-verify]] — Hardware signature verify (ATECC608A / @noble/curves)
- [[ed25519-verify]] — Mobile device signature verify (tweetnacl)
- [[wallet-ownership-proof]] — Ed25519 proof for balance + payout access
- [[anti-replay-seq]] — Monotonic sequence watermark in PiDeviceRegistry
- [[h3-geo-dedup]] — H3 resolution-9/10 spatial deduplication
- [[sybil-slashing]] — VLM confidence < 0.1 → async slash → Solana stake burn
- [[fail-closed-vlm]] — Any VLM failure = QUARANTINE, no reward credited
- [[atomic-reward-credit]] — DynamoDB TransactWrite prevents double-credit

## External Dependencies
- [[stripe]] — Fiat payout via Connect Express + PaymentIntent
- [[sarvam-ai]] — Indian-language STT/TTS (proxied, key in Secrets Manager)
- [[solana-anchor]] — On-chain settlement: mint_to, slash_node, state compression
- [[bedrock-nova-lite-model]] — Foundation model (amazon.nova-lite-v1:0)

## CDK Stacks
- [[vigia-stack]] — Root CDK stack, wires all sub-stacks
- [[ingestion-stack]] — Telemetry API, validator, IoT Core, frames S3, Stripe, Sarvam
- [[intelligence-stack]] — Orchestrator, Bedrock agent, EventBridge pipes, Step Functions
- [[trust-stack]] — DePIN ledger table
- [[innovation-stack]] — Innovation API, maintenance, routing, economic metrics
- [[enterprise-stack]] — Cognito, enterprise API, burn/rewards
- [[session-stack]] — MFS session CRUD, geohash resolver, hash chain validator

## API Routes
- [[post-telemetry]] — POST /telemetry
- [[post-register-device]] — POST /register-device
- [[post-claim-device]] — POST /claim-device
- [[post-verify-hazard-sync]] — POST /verify-hazard-sync
- [[get-hazards]] — GET /hazards
- [[get-ledger]] — GET /ledger
- [[get-traces]] — GET /traces + GET /traces/{hazardId}
- [[get-rewards-balance]] — GET /rewards-balance
- [[post-stripe-routes]] — POST /stripe/{onboard,payout,financial}-session
- [[post-sarvam-proxy]] — POST /sarvam-proxy/{stt,tts}
- [[post-maintenance-report]] — POST /maintenance/report
- [[get-maintenance-queue]] — GET /maintenance/queue
- [[get-economic-metrics]] — GET /economic/metrics
- [[post-routing-agent-branch]] — POST /routing-agent/branch
- [[get-agent-traces-stream]] — GET /agent-traces/stream
- [[enterprise-api-routes]] — /enterprise/* endpoints
- [[session-api-routes]] — /sessions, /geohash/resolve, /places/search

## End-to-End Flows
- [[hazard-attestation-flow]] — Pi MQTT → IoT Core → AttestationFn → HazardsTable
- [[hazard-verification-flow]] — HazardsTable INSERT → EventBridge Pipe → OrchestratorFn
- [[reward-credit-flow]] — VERIFIED hazard → tryCreditReward → RewardsLedger
- [[solana-settlement-flow]] — VERIFIED + credited → submitHazardToChain → Anchor
- [[stripe-payout-flow]] — wallet → /stripe/payout-session → Stripe → fiat
- [[enterprise-data-credit-flow]] — enterprise burn $VIGIA → BurnHistory stream → Data Credits
- [[mobile-ingest-flow]] — mobile → POST /telemetry → ValidatorFn → PENDING → Orchestrator
- [[maintenance-queue-flow]] — VERIFIED hazard → SQS fan-out → MaintenanceQueue

## Key Decisions (ADRs)
- [[adr-iot-core-replaces-fastapi]] — Why IoT Core + Lambda replaced Mosquitto/FastAPI in M12
- [[adr-vlm-sample-rate]] — 2% VLM sampling: economics vs security tradeoff
- [[adr-h3-dedup-model]] — H3 res-9/10 for protocol-level deduplication
- [[adr-bme-off-chain-rewards]] — Off-chain pending balance vs direct on-chain mint
- [[adr-eventbridge-pipes]] — INSERT-only filter reducing Lambda invocations ~60%
