---
title: "GET /maintenance/queue"
type: api-route
tags: [#api-route, innovation]
source: packages/infrastructure/lib/stacks/innovation-stack.ts
related: ["[[api-gateway-innovation]]", "[[maintenance-queue-query-fn]]", "[[maintenance-queue-table]]"]
updated: 2026-06-20
---

# GET /maintenance/queue

Queries the maintenance queue by status or geohash.

**Lambda:** [[maintenance-queue-query-fn]]

## Query Params

`?status=PENDING` or `?geohash=<p7>` (or neither → full scan)

## Links

- [[maintenance-queue-query-fn]], [[maintenance-queue-table]]
