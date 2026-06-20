---
title: "GET /ledger"
type: api-route
tags: [#api-route, ingestion]
source: packages/infrastructure/lib/stacks/ingestion-stack.ts
related: ["[[api-gateway-telemetry]]", "[[ledger-getter-fn]]", "[[ledger-table]]"]
updated: 2026-06-20
---

# GET /ledger

Returns the latest 10 DePIN ledger entries.

**Lambda:** [[ledger-getter-fn]] (ScanCommand, Limit=10)

## Links

- [[ledger-getter-fn]], [[ledger-table]]
