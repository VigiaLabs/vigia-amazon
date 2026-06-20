---
title: "MaintenanceQueueQueryFn"
type: lambda
tags: [#lambda, innovation]
source: packages/backend/functions/maintenance-queue-query/index.ts
related: ["[[maintenance-queue-table]]", "[[get-maintenance-queue]]", "[[innovation-stack]]"]
updated: 2026-06-20
---

# MaintenanceQueueQueryFn

Read-only maintenance queue query. Supports filtering by `status` (StatusIndex GSI) or `geohash` (GeohashIndex GSI); falls back to full scan.

**File:** `packages/backend/functions/maintenance-queue-query/index.ts`
**Runtime:** Node.js 20.x, timeout 5s, memory 256 MB

## Links

- [[maintenance-queue-table]] — reads from; GSI-based queries
- [[get-maintenance-queue]] — API route
- [[innovation-stack]] — CDK construct owning this Lambda
