---
title: "Amazon Nova Lite VLM"
type: external
tags: [#external, ai]
source: packages/backend/src/orchestrator/index.ts
related: ["[[orchestrator-fn]]", "[[bedrock-nova-lite]]", "[[s3-frames-bucket]]", "[[fail-closed-vlm]]", "[[sybil-slashing]]", "[[adr-vlm-sample-rate]]", "[[hazard-verification-flow]]"]
updated: 2026-06-20
---

# Amazon Nova Lite VLM

Amazon Nova Lite vision-language model used for hazard image verification.

**Model ID:** `amazon.nova-lite-v1:0`
**API:** `BedrockRuntimeClient.ConverseCommand`
**Sample rate:** 2% of VERIFIED candidates (`VLM_SAMPLE_RATE=0.02`, default)

## Invocation (orchestrator/index.ts:255)

```ts
const response = await bedrockRuntime.send(new ConverseCommand({
  modelId: 'amazon.nova-lite-v1:0',
  messages: [{
    role: 'user',
    content: [
      { image: { format: 'jpeg', source: { bytes: imgBytes } } },
      { text: `Analyze this road hazard image. Hazard type: ${hazardType}...` }
    ],
  }],
}));
```

## Response Format

JSON extracted from response text:
```json
{ "reasoning": "<analysis>", "confidence": 0.87 }
```

## Confidence Thresholds

- `confidence < 0.1` → Sybil slashing trigger (see [[sybil-slashing]])
- `totalScore >= 65` (weighted with Bedrock Agent) → VERIFIED
- Any VLM exception → [[fail-closed-vlm]] quarantine

## IAM

`bedrock:InvokeModel` on `arn:aws:bedrock:*::foundation-model/amazon.nova-lite-v1:0` — granted to [[orchestrator-fn]] in [[intelligence-stack]].

## Links

- [[orchestrator-fn]] — invokes on 2% of VLM path
- [[bedrock-nova-lite]] — AWS service node for this model
- [[s3-frames-bucket]] — frame source
- [[fail-closed-vlm]] — VLM error handler
- [[sybil-slashing]] — uses confidence < 0.1 to trigger slash
- [[adr-vlm-sample-rate]] — 2% sampling decision
