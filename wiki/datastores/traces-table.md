---
title: "AgentTracesTable (Intelligence)"
type: datastore
tags: [#datastore, intelligence]
source: packages/infrastructure/lib/stacks/intelligence-stack.ts
related: ["[[orchestrator-fn]]", "[[verify-hazard-sync-fn]]", "[[traces-getter-fn]]", "[[intelligence-stack]]"]
updated: 2026-06-20
---

# AgentTracesTable (Intelligence)

Stores Bedrock ReAct reasoning traces from [[orchestrator-fn]] and [[verify-hazard-sync-fn]].

**CDK name:** `AgentTracesTable` (in IntelligenceStack)

## Schema

| Attribute | Type | Description |
|---|---|---|
| `traceId` | String (PK) | UUID |
| `hazardId` | String (SK) | References [[hazards-table]] PK |
| `timestamp` | String | ISO-8601 |
| `steps` | List | Agent reasoning steps with tool use |
| `verdict` | String | VERIFIED / REJECTED |
| `verification_score` | Number | Agent score 0–100 |
| `vlm_reasoning` | String | Nova Lite text |
| `vlm_confidence` | Number | 0–1 |
| `ttl` | Number | Unix epoch (7-day lifecycle) |

## GSI

| Index | PK |
|---|---|
| `HazardIdIndex` | `hazardId` |

Used by `TracesGetterFn` (get-by-hazard.ts) to return traces for a specific hazard.

## Links

- [[orchestrator-fn]] — writes traces after agent run
- [[verify-hazard-sync-fn]] — writes traces after synchronous agent run
- [[traces-getter-fn]] — ScanCommand (Limit=latest) + GSI query
- [[intelligence-stack]] — CDK construct owning this table
