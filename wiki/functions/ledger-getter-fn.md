---
title: "LedgerGetterFn"
type: lambda
tags: [#lambda, ingestion]
source: packages/backend/src/ledger/get-entries.ts
related: ["[[ledger-table]]", "[[get-ledger]]", "[[ingestion-stack]]"]
updated: 2026-06-20
---

# LedgerGetterFn

Returns the latest 10 DePIN ledger entries (sorted by timestamp descending).

**File:** `packages/backend/src/ledger/get-entries.ts`, **Runtime:** Node.js 20.x

## Links

- [[ledger-table]] — ScanCommand (Limit=10)
- [[get-ledger]] — GET /ledger route
- [[ingestion-stack]] — CDK construct
