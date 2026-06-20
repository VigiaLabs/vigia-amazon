---
title: "EconomicMetricsTable"
type: datastore
tags: [#datastore, innovation]
source: packages/infrastructure/lib/stacks/innovation-stack.ts
related: ["[[maintenance-report-handler-fn]]", "[[economic-metrics-query-fn]]", "[[innovation-stack]]"]
updated: 2026-06-20
---

# EconomicMetricsTable

Session-scoped ROI and cost aggregates. Written by [[maintenance-report-handler-fn]], read by [[economic-metrics-query-fn]].

**CDK name:** `EconomicMetricsTable`

## Schema

| Attribute | Type | Description |
|---|---|---|
| `sessionId` | String (PK) | Session or time-window identifier |
| `timestamp` | String (SK) | ISO-8601 |
| `totalHazardsDetected` | Number | Count (ADD) |
| `totalEstimatedRepairCost` | Number | USD cents (ADD) |
| `totalPreventedDamageCost` | Number | USD cents (ADD) |
| `roiMultiplier` | Number | Computed by [[economic-metrics-query-fn]] on read |

## Links

- [[maintenance-report-handler-fn]] — ADD cost counters on new report
- [[economic-metrics-query-fn]] — ScanIndexForward=false, Limit=1; computes ROI
- [[innovation-stack]] — CDK construct owning this table
