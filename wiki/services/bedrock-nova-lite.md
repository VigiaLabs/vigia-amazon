---
title: "Amazon Bedrock — Nova Lite VLM"
type: aws-service
tags: [#aws-service, intelligence, ai, vlm]
source: packages/backend/src/orchestrator/index.ts
related: ["[[orchestrator-fn]]", "[[bedrock-agent]]", "[[hazards-table]]", "[[fail-closed-vlm]]", "[[adr-vlm-sample-rate]]"]
updated: 2026-06-19
---

# Amazon Bedrock — Amazon Nova Lite (Vision Language Model)

Foundation model used for visual hazard verification: confirms whether a dashcam frame shows a genuine physical road hazard.

**Model ID:** `amazon.nova-lite-v1:0`
**Cost:** ~$0.001 per hazard verification (image tile + text)
**Called via:** `BedrockRuntimeClient.ConverseCommand`

## Request Shape (orchestrator:254)

```typescript
{
  modelId: 'amazon.nova-lite-v1:0',
  messages: [{
    role: 'user',
    content: [
      { image: { format: 'jpeg', source: { bytes: imgBytes } } },
      { text: 'Analyze this dashcam frame. Is this a genuine physical road hazard? Return ... {"reasoning": "...", "confidence": 0.8}' }
    ]
  }]
}
```

## Response Parsing

Nova may wrap JSON in prose. The orchestrator extracts the first `{...}` block with regex. If parsing fails entirely, the fail-closed path quarantines the event (no reward).

## Sampling Rate

Only 2% of hazard events reach the VLM — see [[adr-vlm-sample-rate]]. The other 98% are scored deterministically from ONNX confidence.

## Spoof Detection

VLM confidence < 0.1 → triggers async [[slash-node-fn]] invocation → Solana stake burn + blacklist.

## Links

- Called by → [[orchestrator-fn]]
- Foundation of → [[bedrock-agent]]
- Frame source → [[s3-frames-bucket]]
- Spoof action → [[slash-node-fn]]
- Security → [[fail-closed-vlm]], [[sybil-slashing]]
- Decision → [[adr-vlm-sample-rate]]
