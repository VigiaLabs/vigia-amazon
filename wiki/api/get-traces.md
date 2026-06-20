---
title: "GET /traces and GET /traces/{hazardId}"
type: api-route
tags: [#api-route, ingestion]
source: packages/infrastructure/lib/stacks/ingestion-stack.ts
related: ["[[api-gateway-telemetry]]", "[[traces-getter-fn]]", "[[traces-table]]"]
updated: 2026-06-20
---

# GET /traces and GET /traces/{hazardId}

`GET /traces` — returns latest Bedrock ReAct traces (ScanCommand).
`GET /traces/{hazardId}` — returns traces for specific hazard via `HazardIdIndex` GSI.

**Lambda:** [[traces-getter-fn]]

## Links

- [[traces-getter-fn]], [[traces-table]]
