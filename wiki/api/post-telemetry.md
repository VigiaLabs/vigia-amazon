---
title: "POST /telemetry"
type: api-route
tags: [#api-route, ingestion]
source: packages/infrastructure/lib/stacks/ingestion-stack.ts
related: ["[[api-gateway-telemetry]]", "[[validator-fn]]", "[[mobile-ingest-flow]]"]
updated: 2026-06-20
---

# POST /telemetry

Accepts mobile hazard telemetry. Entry point for the mobile ingest pipeline.

**API:** [[api-gateway-telemetry]], stage `prod`
**Lambda:** [[validator-fn]] (POST integration, proxy=true)

## Request Body

```json
{
  "hazardType": "POTHOLE",
  "lat": 12.9716,
  "lon": 77.5946,
  "confidence": 0.87,
  "timestamp": 1719000000000,
  "wallet_address": "<base58>",
  "signature": "<base58 Ed25519>",
  "frame_base64": "<optional base64 JPEG>"
}
```

## Response

`202 { hazardId, status:'PENDING' }` on success.
`400` on missing/invalid fields. `401` on bad signature. `403` on blacklisted device.

## Links

- [[api-gateway-telemetry]] — REST API host
- [[validator-fn]] — handler
- [[mobile-ingest-flow]] — end-to-end flow
