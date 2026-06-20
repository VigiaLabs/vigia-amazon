---
title: "LedgerTable"
type: datastore
tags: [#datastore, trust]
source: packages/infrastructure/lib/stacks/trust-stack.ts
related: ["[[orchestrator-fn]]", "[[verify-hazard-sync-fn]]", "[[ledger-getter-fn]]", "[[hash-chain-validator-fn]]", "[[trust-stack]]"]
updated: 2026-06-20
---

# LedgerTable

DePIN hash-chain ledger. Streams NEW_IMAGE. `trust-stack.ts:21`.

**CDK name:** `LedgerTable`

## Schema

| Attribute | Type | Description |
|---|---|---|
| `ledgerId` | String (PK) | UUID (hazardId) |
| `timestamp` | String (SK) | ISO-8601 |
| `sessionId` | String | Links to session / workflow |
| `action` | String | REWARD_CREDIT, etc. |
| `contributorId` | String | Wallet address |
| `previousHash` | String | `'genesis'` for first entry |
| `currentHash` | String | SHA-256(timestamp+sessionId+action+previousHash+contributorId) |
| `payload` | Map | hazardId, h3_index, etc. |
| `ttl` | Number | Unix epoch |

## Stream

NEW_IMAGE → [[hash-chain-validator-fn]] validates integrity on-demand via GET /sessions/{sessionId}/validate.

## Links

- [[orchestrator-fn]] — writes ledger entry in atomic TransactWrite
- [[verify-hazard-sync-fn]] — writes ledger entry after reward
- [[ledger-getter-fn]] — GET /ledger (ScanCommand Limit=10)
- [[hash-chain-validator-fn]] — reads and validates hash chain
- [[trust-stack]] — CDK construct owning this table
