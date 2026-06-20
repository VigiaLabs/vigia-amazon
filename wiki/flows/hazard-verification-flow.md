---
title: "Hazard Verification Flow"
type: flow
tags: [#flow, intelligence]
source: packages/backend/src/orchestrator/index.ts
related: ["[[orchestrator-fn]]", "[[eventbridge-pipes]]", "[[bedrock-nova-lite]]", "[[bedrock-agent]]", "[[s3-frames-bucket]]", "[[hazards-table]]", "[[cooldown-table]]", "[[fail-closed-vlm]]", "[[sybil-slashing]]", "[[reward-credit-flow]]"]
updated: 2026-06-20
---

# Hazard Verification Flow

Async pipeline that assigns VERIFIED/REJECTED/UNVERIFIED_VLM_FAILED status to a PENDING hazard.

## Steps

```
HazardsTable INSERT
  ▼
DynamoDB Stream (NEW_AND_OLD_IMAGES)
  ▼
EventBridge Pipe (INSERT-only filter, batch=10, FIRE_AND_FORGET)
  ▼
OrchestratorFn
  │  GetItem CooldownTable proc#<geohash>#<ts> → skip if exists (dedup)
  │
  ├─ 98% FAST PATH (Math.random() >= 0.02)
  │    ONNX confidence ≥ 0.65 → VERIFIED
  │    ONNX confidence <  0.65 → REJECTED
  │    tryCreditReward() on VERIFIED
  │    PutItem CooldownTable (30s TTL)
  │
  └─ 2% VLM PATH
       S3 GetObject frames/<geohash>/<ts>.jpg
       ConverseCommand → Nova Lite → { reasoning, confidence }
       confidence < 0.1 → async InvokeCommand(SlashNodeFn)     ← sybil slash
       InvokeAgentCommand → Bedrock Agent → verificationScore
       totalScore ≥ 65 → VERIFIED
       tryCreditReward() on VERIFIED
       PutItem CooldownTable (30s TTL)
       [VLM exception] → UNVERIFIED_VLM_FAILED (fail-closed)

  ▼ VERIFIED path continues to:
[[reward-credit-flow]], [[solana-settlement-flow]]
```

## Links

- [[orchestrator-fn]], [[eventbridge-pipes]], [[cooldown-table]]
- [[bedrock-nova-lite]], [[bedrock-agent]], [[s3-frames-bucket]]
- [[fail-closed-vlm]], [[sybil-slashing]]
- [[reward-credit-flow]], [[solana-settlement-flow]]
