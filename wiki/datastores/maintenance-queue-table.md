---
title: "MaintenanceQueueTable"
type: datastore
tags: [#datastore, innovation]
source: packages/infrastructure/lib/stacks/innovation-stack.ts
related: ["[[maintenance-report-handler-fn]]", "[[maintenance-queue-query-fn]]", "[[sqs-maintenance-queue]]", "[[innovation-stack]]"]
updated: 2026-06-20
---

# MaintenanceQueueTable

Repair job queue with cost estimates. Fed by [[sqs-maintenance-queue]] fan-out from VERIFIED hazards.

**CDK name:** `MaintenanceQueueTable`

## Schema

| Attribute | Type | Description |
|---|---|---|
| `reportId` | String (PK) | UUID |
| `hazardId` | String | References [[hazards-table]] |
| `geohash` | String | ngeohash precision-7 |
| `hazardType` | String | POTHOLE / DEBRIS / FLOODING / ACCIDENT |
| `severity` | Number | 0–1 |
| `status` | String | PENDING / IN_PROGRESS / COMPLETED / REJECTED |
| `estimatedCost` | Number | USD cents (`baseCost * (1 + severity * 0.2)`) |
| `preventedDamageCost` | Number | USD cents |
| `assignedCrew` | String | Optional crew ID |
| `createdAt` | String | ISO-8601 |
| `resolvedAt` | String | Optional |

## GSIs

| Index | PK |
|---|---|
| `StatusIndex` | `status` |
| `GeohashIndex` | `geohash` |

## Links

- [[maintenance-report-handler-fn]] — PutItem + UpdateItem
- [[maintenance-queue-query-fn]] — queries via StatusIndex or GeohashIndex
- [[sqs-maintenance-queue]] — upstream fan-out source
- [[innovation-stack]] — CDK construct owning this table
