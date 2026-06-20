---
title: "OrchestratorFn"
type: lambda
tags: [#lambda, intelligence]
source: packages/backend/src/orchestrator/index.ts
related: ["[[hazards-table]]", "[[cooldown-table]]", "[[traces-table]]", "[[rewards-ledger-table]]", "[[ledger-table]]", "[[s3-frames-bucket]]", "[[bedrock-nova-lite]]", "[[bedrock-agent]]", "[[slash-node-fn]]", "[[eventbridge-pipes]]", "[[sqs-orchestrator-dlq]]", "[[atomic-reward-credit]]", "[[fail-closed-vlm]]", "[[sybil-slashing]]", "[[adr-vlm-sample-rate]]", "[[solana-anchor]]", "[[hazard-verification-flow]]", "[[reward-credit-flow]]", "[[intelligence-stack]]"]
updated: 2026-06-20
---

# OrchestratorFn

Core hazard verification and reward orchestration Lambda. Triggered by [[eventbridge-pipes]] (INSERT events from [[hazards-table]] DynamoDB stream, async FIRE_AND_FORGET, batch 10).

**File:** `packages/backend/src/orchestrator/index.ts`
**Runtime:** Node.js 20.x, timeout 30s

## Handler Logic (orchestrator/index.ts:177)

### Pre-check (line 196)
- `GetCommand` on CooldownTable with key `proc#<geohash>#<timestamp>`. If exists → skip (dedup).

### 98% Fast Path (line 206)
- `VLM_SAMPLE_RATE` default `0.02`. `Math.random() >= VLM_SAMPLE_RATE` → fast path.
- ONNX confidence ≥ 0.65 → `verdict='VERIFIED'`; else `'REJECTED'`.
- `tryCreditReward()` on VERIFIED.
- `PutCommand` to TracesTable with `vlm_reasoning: 'VLM skipped — deterministic fast path'`.
- `PutCommand` to CooldownTable with 30-sec TTL.

### 2% VLM Path (lines 243-289)
1. **S3 fetch** (line 249) — `GetObjectCommand({ Bucket: FRAMES_BUCKET, Key: s3_key })`.
2. **Nova Lite VLM** (lines 255-273) — `ConverseCommand` with image bytes + text prompt. JSON-extracted response: `{reasoning, confidence}`.
3. **Spoof detection** (line 278) — `vlmConfidence < 0.1` → async `InvokeCommand` on SlashNodeFn (InvocationType='Event').
4. **ReAct Agent** (line 320) — `invokeAgent(geohash, hazardType, vlmReasoning, vlmConfidence)`.
   - Retries up to 3× on transient timeout/dependency errors.
   - Parses `orchestrationTrace`: rationale, tool use (action + input), tool observation (extracts `verificationScore`), final response.
5. **Score + verdict** (line 325) — Agent score takes precedence. `totalScore ≥ 65 → VERIFIED`.
6. **`tryCreditReward()`** (line 348) — atomic 3-item TransactWrite.
7. **Solana submit** (line 363) — non-blocking: `submitHazardToChain({ h3Index, epochDay, discovererPubkey, vlmConfidence, onnxConfidence, signatureHash })`.

### `tryCreditReward()` (lines 142-175)
DynamoDB `TransactWriteCommand` with 3 items:
- PUT CooldownTable: `rwd#<wallet>#<geohash>` (ConditionExpression: attribute_not_exists, 30-day TTL)
- UPDATE RewardsLedgerTable: `ADD pending_balance 1e18, total_earned 1e18`
- PUT LedgerTable: ledger entry with SHA-256 `currentHash`

Returns `true` iff transaction committed; `false` on `TransactionCanceledException`.

### Fail-Closed VLM (lines 291-316)
Any failure in S3 fetch or Bedrock Converse → `UpdateCommand` status=`UNVERIFIED_VLM_FAILED`, no reward, cooldown PUT.

## Links

- [[eventbridge-pipes]] — trigger (INSERT-only filter)
- [[bedrock-nova-lite]] — VLM on 2% sample
- [[bedrock-agent]] — ReAct verification (TAWWC3SQ0L)
- [[slash-node-fn]] — async spoof response
- [[atomic-reward-credit]] — tryCreditReward mechanism
- [[fail-closed-vlm]] — quarantine on VLM error
- [[sybil-slashing]] — VLM < 0.1 → slash
- [[solana-anchor]] — non-blocking on-chain submit
- [[hazards-table]], [[cooldown-table]], [[traces-table]], [[rewards-ledger-table]], [[ledger-table]], [[s3-frames-bucket]]
- [[hazard-verification-flow]], [[reward-credit-flow]], [[solana-settlement-flow]]
- [[adr-vlm-sample-rate]] — 2% sampling decision
- [[intelligence-stack]] — CDK construct owning this Lambda
