---
title: "POST /verify-hazard-sync"
type: api-route
tags: [#api-route, intelligence]
source: packages/infrastructure/lib/vigia-stack.ts
related: ["[[api-gateway-telemetry]]", "[[verify-hazard-sync-fn]]", "[[bedrock-agent]]"]
updated: 2026-06-20
---

# POST /verify-hazard-sync

Synchronous Bedrock Agent hazard verification. Blocks until verification completes (≤29s). Added to telemetry API by [[vigia-stack]] cross-stack wiring.

**Lambda:** [[verify-hazard-sync-fn]], timeout 29s

## Request Body

```json
{
  "hazardId": "<uuid>",
  "hazardType": "POTHOLE",
  "lat": 12.97, "lon": 77.59,
  "confidence": 0.87,
  "timestamp": 1719000000000,
  "geohash": "tdr1u8s",
  "signature": "<base58>"
}
```

## Response

```json
{
  "hazardId": "...", "status": "VERIFIED",
  "verificationScore": 78,
  "steps": [{ "thought":…, "action":…, "observation":… }],
  "reasoning": "...",
  "rewardCredited": true
}
```

## Links

- [[verify-hazard-sync-fn]] — handler
- [[bedrock-agent]] — real Bedrock Agent path
