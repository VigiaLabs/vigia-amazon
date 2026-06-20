---
title: "ADR: 2% VLM Sampling Rate"
type: decision
tags: [#decision, intelligence]
source: packages/backend/src/orchestrator/index.ts
related: ["[[orchestrator-fn]]", "[[bedrock-nova-lite]]", "[[sybil-slashing]]", "[[fail-closed-vlm]]", "[[adr-h3-dedup-model]]"]
updated: 2026-06-20
---

# ADR: 2% VLM Sampling Rate

## Context

Amazon Nova Lite VLM calls have per-invocation cost. Calling VLM on every hazard submission would be expensive at scale and add latency to the verification path.

## Decision

`VLM_SAMPLE_RATE = 0.02` (2% of submissions). 98% use the ONNX fast path with a static confidence threshold (≥0.65 → VERIFIED).

## Rationale

- **Cost control:** VLM call on 100% of submissions at $X each would be prohibitive at DePIN scale.
- **ONNX threshold sufficient for bulk verification:** Edge inference with calibrated confidence threshold provides adequate first-pass filtering.
- **Statistical sampling preserves security:** Attackers cannot know which submissions will be VLM-checked, so faking confidence on 98% of submissions still risks being caught in the 2% VLM sample.
- **Sybil slashing incentive:** Even 2% coverage means fraudulent nodes face expected on-chain penalty, making sustained Sybil attacks economically irrational.

## Consequences

- Systematic spoofers who generate ≥50 faked submissions statistically expect ≥1 VLM check + slash.
- 98% fast path cannot generate VLM evidence for slashing.
- See [[fail-closed-vlm]] for VLM error handling.

## Links

- [[orchestrator-fn]] — implements `Math.random() >= VLM_SAMPLE_RATE`
- [[bedrock-nova-lite]] — VLM on the 2% path
- [[sybil-slashing]], [[fail-closed-vlm]] — security consequences of this decision
