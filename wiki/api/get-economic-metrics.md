---
title: "GET /economic/metrics"
type: api-route
tags: [#api-route, innovation]
source: packages/infrastructure/lib/stacks/innovation-stack.ts
related: ["[[api-gateway-innovation]]", "[[economic-metrics-query-fn]]", "[[economic-metrics-table]]"]
updated: 2026-06-20
---

# GET /economic/metrics

Returns ROI and cost aggregates for a session.

**Lambda:** [[economic-metrics-query-fn]]

## Query Params

`?sessionId=<uuid>`

## Response

```json
{
  "sessionId":"...", "totalHazardsDetected":42,
  "totalEstimatedRepairCost":6300,
  "totalPreventedDamageCost":12600,
  "roiMultiplier":2.0
}
```

## Links

- [[economic-metrics-query-fn]], [[economic-metrics-table]]
