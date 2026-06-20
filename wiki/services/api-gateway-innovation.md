---
title: "API Gateway — Innovation API"
type: aws-service
tags: [#aws-service, innovation, api]
source: packages/infrastructure/lib/stacks/innovation-stack.ts
related: ["[[routing-agent-branch-fn]]", "[[agent-trace-streamer-fn]]", "[[maintenance-report-handler-fn]]", "[[maintenance-queue-query-fn]]", "[[economic-metrics-query-fn]]", "[[rewards-balance-fn]]", "[[innovation-stack]]"]
updated: 2026-06-19
---

# API Gateway — VIGIA Innovation API

REST API for maintenance queue management, routing intelligence, agent trace streaming, economic metrics, and rewards balance.

## Routes

| Method | Path | Lambda |
|--------|------|--------|
| POST | /routing-agent/branch | [[routing-agent-branch-fn]] |
| GET | /agent-traces/stream | [[agent-trace-streamer-fn]] (SSE) |
| POST | /maintenance/report | [[maintenance-report-handler-fn]] |
| GET | /maintenance/queue | [[maintenance-queue-query-fn]] |
| GET | /economic/metrics | [[economic-metrics-query-fn]] |
| GET | /rewards-balance | [[rewards-balance-fn]] |

## Links

- Routes to → [[routing-agent-branch-fn]], [[agent-trace-streamer-fn]], [[maintenance-report-handler-fn]], [[maintenance-queue-query-fn]], [[economic-metrics-query-fn]], [[rewards-balance-fn]]
- Defined in → [[innovation-stack]]
