---
title: "EconomicMetricsQueryFn"
type: lambda
tags: [#lambda, innovation]
source: packages/backend/functions/economic-metrics-query/index.ts
related: ["[[economic-metrics-table]]", "[[get-economic-metrics]]", "[[innovation-stack]]"]
updated: 2026-06-20
---

# EconomicMetricsQueryFn

Queries ROI and cost aggregates per `sessionId`. Computes `roiMultiplier = totalPreventedDamageCost / totalEstimatedRepairCost`.

**File:** `packages/backend/functions/economic-metrics-query/index.ts`
**Runtime:** Node.js 20.x, timeout 5s, memory 256 MB

## Links

- [[economic-metrics-table]] — reads latest metrics by sessionId (ScanIndexForward=false, Limit=1)
- [[get-economic-metrics]] — API route
- [[innovation-stack]] — CDK construct owning this Lambda
