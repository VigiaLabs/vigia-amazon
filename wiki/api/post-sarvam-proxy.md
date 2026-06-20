---
title: "POST /sarvam-proxy/*"
type: api-route
tags: [#api-route, ingestion]
source: packages/infrastructure/lib/stacks/ingestion-stack.ts
related: ["[[api-gateway-telemetry]]", "[[sarvam-proxy-fn]]", "[[sarvam-ai]]"]
updated: 2026-06-20
---

# POST /sarvam-proxy/*

Two Sarvam AI proxy routes:

| Path | Content-Type | Description |
|---|---|---|
| `POST /sarvam-proxy/stt` | multipart/form-data | Forward audio to Sarvam STT |
| `POST /sarvam-proxy/tts` | application/json | Forward text+language to Sarvam TTS |

**Lambda:** [[sarvam-proxy-fn]]

## Links

- [[sarvam-proxy-fn]], [[sarvam-ai]]
