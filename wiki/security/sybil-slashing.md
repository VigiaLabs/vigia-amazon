---
title: "Sybil Slashing"
type: security
tags: [#security, intelligence]
source: packages/backend/src/orchestrator/index.ts
related: ["[[orchestrator-fn]]", "[[slash-node-fn]]", "[[bedrock-nova-lite]]", "[[solana-anchor]]", "[[vigia-device-registry]]", "[[sqs-slash-dlq]]", "[[fail-closed-vlm]]"]
updated: 2026-06-20
---

# Sybil Slashing

Automated on-chain penalty for nodes that submit spoofed or fabricated hazard evidence.

## Trigger Condition (orchestrator/index.ts:278)

VLM path only (2% sample). If `vlmConfidence < 0.1`:
```ts
await lambda.send(new InvokeCommand({
  FunctionName: SLASH_NODE_FN_ARN,
  InvocationType: 'Event',    // async, fire-and-forget
  Payload: JSON.stringify({ walletAddress, hazardId, reason: 'VLM_LOW_CONFIDENCE', evidence }),
}));
```

## What SlashNodeFn Does

1. Calls Anchor instruction `slash_node` on program `BKaxbk73bCY8xRuphpkTESWjaJofdnBpuc2T193f3nkW` (devnet)
2. Burns portion of node stake on-chain (Solana VersionedTransaction, `'confirmed'` commitment)
3. Sets `blacklisted=true` in [[vigia-device-registry]] → all future submissions rejected by [[validator-fn]]

## DLQ

[[sqs-slash-dlq]] captures failures (retryAttempts=2, 14-day retention). Dead slashes are reviewed manually.

## Note: 98% Fast Path

Sybil slashing only operates on the 2% VLM path. The 98% fast path uses ONNX confidence threshold but cannot generate VLM evidence for slashing — this is the tradeoff documented in [[adr-vlm-sample-rate]].

## Links

- [[orchestrator-fn]] — triggers slash async
- [[slash-node-fn]] — executes on-chain slash + blacklist
- [[bedrock-nova-lite]] — VLM confidence source
- [[solana-anchor]] — on-chain slash program
- [[vigia-device-registry]] — blacklist write
- [[sqs-slash-dlq]] — DLQ for failed slashes
- [[fail-closed-vlm]] — complementary defence: VLM errors quarantine, not reward
