---
title: "VerifyHazardSyncFn"
type: lambda
tags: [#lambda, intelligence]
source: packages/backend/functions/verify-hazard-sync/index.ts
related: ["[[bedrock-agent]]", "[[hazards-table]]", "[[traces-table]]", "[[rewards-ledger-table]]", "[[ledger-table]]", "[[vigia-device-registry]]", "[[h3-geo-dedup]]", "[[atomic-reward-credit]]", "[[post-verify-hazard-sync]]", "[[intelligence-stack]]"]
updated: 2026-06-20
---

# VerifyHazardSyncFn

Synchronous Bedrock Agent verification path for interactive demo. Mirrors the async OrchestratorFn pipeline but blocks until a verification score is returned.

**File:** `packages/backend/functions/verify-hazard-sync/index.ts`
**Runtime:** Node.js 20.x, timeout 29s (< API GW 29s limit), memory 256 MB

## Handler Logic (verify-hazard-sync/index.ts:80)

1. Parse `VerifyRequest` from body: `{hazardId, hazardType, lat, lon, confidence, timestamp, geohash, signature}`.
2. **ECDSA device registry verify** (lines 103-117): `ethers.verifyMessage(payloadStr, signature)` → recovers `driverWalletAddress`. Checks DeviceRegistryTable. Rejects if unknown.
3. **Store as UNVERIFIED** (line 122): PutCommand to HazardsTable with `h3_index`, `status: 'UNVERIFIED'`.
4. **H3 dedup check** (line 167): queries `h3-hazardtype-index` GSI for VERIFIED entries in last 12h.
5. **Simulation path** (line 159): if `AGENT_ID === 'placeholder'` → generates mock steps, `creditReward()`, returns score.
6. **Real Bedrock Agent path** (line 221): `InvokeAgentCommand` with `enableTrace:true`. Parses orchestration traces to extract steps, tool calls, observations, and verificationScore.
7. **Credit reward** (line 327): `creditReward(walletAddress)` — single `UpdateCommand` ADD (not atomic TransactWrite; see [[orchestrator-fn]] for full atomic version).
8. **Persist trace + update hazard status** (lines 343-384).

## Fallback

`bedrockError` caught → simulation fallback: random `similarCount`, score from confidence.

## Links

- [[bedrock-agent]] — real verification path
- [[hazards-table]] — write UNVERIFIED + update to VERIFIED
- [[traces-table]], [[rewards-ledger-table]], [[ledger-table]] — data writes
- [[vigia-device-registry]] — ECDSA signer lookup
- [[h3-geo-dedup]] — dedup check before crediting
- [[atomic-reward-credit]] — simplified here; see orchestrator for full TransactWrite
- [[post-verify-hazard-sync]] — API route
- [[intelligence-stack]] — CDK construct owning this Lambda
