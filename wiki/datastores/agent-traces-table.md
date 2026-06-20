---
title: "AgentTracesTable (Innovation)"
type: datastore
tags: [#datastore, innovation]
source: packages/infrastructure/lib/stacks/innovation-stack.ts
related: ["[[agent-trace-streamer-fn]]", "[[innovation-stack]]"]
updated: 2026-06-20
---

# AgentTracesTable (Innovation)

Stores SSE-streamed ReAct traces from [[agent-trace-streamer-fn]]. Distinct from [[traces-table]] (intelligence stack).

**CDK name:** `AgentTracesTable` (in InnovationStack — different table from intelligence-stack's AgentTracesTable)

## Schema

| Attribute | Type | Description |
|---|---|---|
| `traceId` | String (PK) | UUID |
| `geohash` | String (SK) | ngeohash precision-7 |
| `contributorId` | String | Wallet address |
| `steps` | List | ReAct reasoning steps |
| `ttl` | Number | Unix epoch (7-day lifecycle) |

## GSI

| Index | PK |
|---|---|
| `HazardIdIndex` | `hazardId` |

## Links

- [[agent-trace-streamer-fn]] — PutCommand (mock traces)
- [[innovation-stack]] — CDK construct owning this table
