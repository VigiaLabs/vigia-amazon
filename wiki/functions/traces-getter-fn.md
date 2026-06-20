---
title: "TracesGetterFn"
type: lambda
tags: [#lambda, ingestion]
source: packages/backend/src/traces/get-latest.ts
related: ["[[traces-table]]", "[[get-traces]]", "[[ingestion-stack]]"]
updated: 2026-06-20
---

# TracesGetterFn

Returns latest Bedrock ReAct traces. Also a sibling TracesByHazardFn (get-by-hazard.ts) queries by hazardId via HazardIdIndex GSI.

**Files:** `packages/backend/src/traces/get-latest.ts`, `get-by-hazard.ts`, **Runtime:** Node.js 20.x

## Links

- [[traces-table]] — reads traces (+ HazardIdIndex GSI for by-hazard query)
- [[get-traces]] — GET /traces and GET /traces/{hazardId}
- [[ingestion-stack]] — CDK construct
