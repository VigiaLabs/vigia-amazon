---
title: "SessionFilesTable"
type: datastore
tags: [#datastore, session]
source: packages/infrastructure/lib/stacks/session-stack.ts
related: ["[[session-crud-fn]]", "[[session-stack]]"]
updated: 2026-06-20
---

# SessionFilesTable

Map-as-a-File-System (MFS) session metadata. `removalPolicy: RETAIN`.

**CDK name:** `SessionFilesTable`

## Schema

| Attribute | Type | Description |
|---|---|---|
| `sessionId` | String (PK) | UUID |
| `geohash7` | String (SK) | ngeohash precision-7 root |
| `status` | String | ACTIVE / ARCHIVED |
| `createdAt` | String | ISO-8601 |
| `updatedAt` | String | ISO-8601 |
| `files` | Map | MFS file entries |

## GSIs

| Index | PK | SK |
|---|---|---|
| `geohash7-timestamp-index` | `geohash7` | `createdAt` |
| `status-timestamp-index` | `status` | `updatedAt` |

## Links

- [[session-crud-fn]] — full CRUD
- [[session-stack]] — CDK construct owning this table
