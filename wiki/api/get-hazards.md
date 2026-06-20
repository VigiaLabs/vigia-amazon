---
title: "GET /hazards"
type: api-route
tags: [#api-route, ingestion]
source: packages/infrastructure/lib/stacks/ingestion-stack.ts
related: ["[[api-gateway-telemetry]]", "[[hazards-getter-fn]]", "[[hazards-table]]"]
updated: 2026-06-20
---

# GET /hazards

Returns the latest 100 hazards sorted by timestamp descending.

**Lambda:** [[hazards-getter-fn]] (ScanCommand, Limit=100)

## Response

```json
{ "hazards": [{ "hazardId":…, "status":…, "hazardType":…, "lat":…, "lon":… }] }
```

## Links

- [[hazards-getter-fn]], [[hazards-table]]
