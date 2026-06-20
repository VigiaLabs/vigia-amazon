---
title: "AgentTraceStreamerFn"
type: lambda
tags: [#lambda, innovation]
source: packages/backend/functions/agent-trace-streamer/index.ts
related: ["[[agent-traces-table]]", "[[get-agent-traces-stream]]", "[[innovation-stack]]"]
updated: 2026-06-20
---

# AgentTraceStreamerFn

SSE (Server-Sent Events) trace streaming Lambda. Currently generates mock ReAct traces and persists them to DynamoDB; real Bedrock streaming is noted as a TODO.

**File:** `packages/backend/functions/agent-trace-streamer/index.ts`
**Runtime:** Node.js 20.x, timeout 60s, memory 1024 MB

## Handler Logic

1. Generates 3 mock trace objects (each with `traceId`, `geohash`, `contributorId`, `steps[]`).
2. For each trace: `PutCommand` to AgentTracesTable (TTL 7 days). Appends `data: <json>\n\n` to SSE body.
3. Returns `Content-Type: text/event-stream`, `Cache-Control: no-cache`.

## Links

- [[agent-traces-table]] — writes traces
- [[get-agent-traces-stream]] — API route
- [[innovation-stack]] — CDK construct owning this Lambda
