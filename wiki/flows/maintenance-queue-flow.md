---
title: "Maintenance Queue Flow"
type: flow
tags: [#flow, intelligence]
source: packages/infrastructure/lib/stacks/intelligence-stack.ts
related: ["[[hazards-table]]", "[[eventbridge-pipes]]", "[[sqs-maintenance-queue]]", "[[maintenance-queue-table]]", "[[maintenance-report-handler-fn]]"]
updated: 2026-06-20
---

# Maintenance Queue Flow

VERIFIED hazards fan out to the maintenance queue for repair dispatch.

## Steps

```
HazardsTable MODIFY (status changes to VERIFIED)
  ▼
DynamoDB Stream (NEW_AND_OLD_IMAGES)
  ▼
EventBridge Pipe #2 (MODIFY + newImage.status = 'VERIFIED' filter, batch=1)
  ▼
SQS MaintenanceQueue (target)
  │  Message body: hazardId, geohash, hazardType, severity, lat, lon
  ▼
(Consumer: POST /maintenance/report called by downstream system)
MaintenanceReportHandlerFn
  │  PutItem MaintenanceQueueTable (calculateRepairCost)
  │  UpdateItem EconomicMetricsTable ADD cost counters
```

## Links

- [[hazards-table]], [[eventbridge-pipes]], [[sqs-maintenance-queue]]
- [[maintenance-queue-table]], [[maintenance-report-handler-fn]], [[economic-metrics-table]]
