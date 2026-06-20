---
title: "MaintenanceReportHandlerFn"
type: lambda
tags: [#lambda, innovation]
source: packages/backend/functions/maintenance-report-handler/index.ts
related: ["[[maintenance-queue-table]]", "[[economic-metrics-table]]", "[[post-maintenance-report]]", "[[innovation-stack]]"]
updated: 2026-06-20
---

# MaintenanceReportHandlerFn

Creates maintenance queue entries and updates economic metrics. Also handles status updates for existing reports.

**File:** `packages/backend/functions/maintenance-report-handler/index.ts`
**Runtime:** Node.js 20.x, timeout 10s, memory 256 MB

## Base Costs (line 18)

| Type | Repair Cost | Prevented Damage |
|---|---|---|
| POTHOLE | $150 | $300 |
| DEBRIS | $50 | $150 |
| FLOODING | $1,000 | $2,000 |
| ACCIDENT | $0 | $5,000 |

`estimatedCost = baseCost * (1 + severity * 0.2)` (line 32).

## Handler Logic

- **Status update mode** (line 45): if `reportIdInput` + `status` in body (without `hazardId`): validates status (PENDING/IN_PROGRESS/COMPLETED/REJECTED), queries table by `reportId`, `UpdateCommand` with key.
- **New report mode** (line 108): `PutCommand` to MaintenanceQueueTable + `UpdateCommand ADD` on EconomicMetricsTable.

## Links

- [[maintenance-queue-table]] — primary write target
- [[economic-metrics-table]] — increments totalHazardsDetected, totalEstimatedRepairCost, totalPreventedDamageCost
- [[post-maintenance-report]] — API route
- [[innovation-stack]] — CDK construct owning this Lambda
