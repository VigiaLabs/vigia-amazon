---
title: "GET /agent-traces/stream"
type: api-route
tags: [#api-route, innovation]
source: packages/infrastructure/lib/stacks/innovation-stack.ts
related: ["[[api-gateway-innovation]]", "[[agent-trace-streamer-fn]]", "[[agent-traces-table]]"]
updated: 2026-06-20
---

# GET /agent-traces/stream

SSE endpoint streaming ReAct traces as `data: <json>\n\n` events.

**Lambda:** [[agent-trace-streamer-fn]], `Content-Type: text/event-stream`

## Links

- [[agent-trace-streamer-fn]], [[agent-traces-table]]
