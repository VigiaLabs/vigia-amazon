---
title: "API Gateway — Telemetry API"
type: aws-service
tags: [#aws-service, ingestion, api]
source: packages/infrastructure/lib/stacks/ingestion-stack.ts
related: ["[[validator-fn]]", "[[register-device-fn]]", "[[claim-device-fn]]", "[[stripe-payout-fn]]", "[[sarvam-proxy-fn]]", "[[verify-hazard-sync-fn]]", "[[ingestion-stack]]"]
updated: 2026-06-19
---

# API Gateway — VIGIA Telemetry API

REST API gateway for mobile telemetry ingest, device management, Stripe payouts, and Sarvam STT/TTS proxy.

**Stage:** `prod`
**Throttling:** 100 rps burst 200

## Routes

| Method | Path | Lambda | Purpose |
|--------|------|--------|---------|
| POST | /telemetry | [[validator-fn]] | Ed25519 mobile hazard submission |
| POST | /register-device | [[register-device-fn]] | Wallet self-registration |
| POST | /claim-device | [[claim-device-fn]] | Hardware/wallet binding |
| POST | /verify-hazard-sync | [[verify-hazard-sync-fn]] | Interactive Bedrock verify |
| GET | /hazards | HazardsGetterFn | List hazards |
| GET | /ledger | LedgerGetterFn | DePIN ledger entries |
| GET | /traces | TracesGetterFn | Bedrock ReAct traces |
| GET | /traces/{hazardId} | TracesByHazardFn | Traces for a hazard |
| POST | /stripe/onboard-session | [[stripe-payout-fn]] | Stripe Connect onboarding |
| POST | /stripe/payout-session | [[stripe-payout-fn]] | PaymentIntent payout |
| POST | /stripe/financial-session | [[stripe-payout-fn]] | Bank account linking |
| POST | /sarvam-proxy/stt | [[sarvam-proxy-fn]] | Indian STT proxy |
| POST | /sarvam-proxy/tts | [[sarvam-proxy-fn]] | Indian TTS proxy |

## Links

- Routes to → [[validator-fn]], [[register-device-fn]], [[claim-device-fn]], [[stripe-payout-fn]], [[sarvam-proxy-fn]], [[verify-hazard-sync-fn]]
- Defined in → [[ingestion-stack]]
