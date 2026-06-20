---
title: "LedgerEntriesTable"
type: datastore
tags: [#datastore, session]
source: packages/infrastructure/lib/stacks/session-stack.ts
related: ["[[session-crud-fn]]", "[[hash-chain-validator-fn]]", "[[session-stack]]"]
updated: 2026-06-20
---

# LedgerEntriesTable

MFS session hash-chain ledger. DynamoDB Stream NEW_IMAGE. `removalPolicy: RETAIN`.

**CDK name:** `LedgerEntriesTable`

## Schema matches [[ledger-table]] but scoped to MFS sessions.

## Links

- [[session-crud-fn]] — writes entries on session mutation
- [[hash-chain-validator-fn]] — reads ordered entries for chain validation
- [[session-stack]] — CDK construct owning this table
