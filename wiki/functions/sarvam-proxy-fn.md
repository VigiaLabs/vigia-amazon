---
title: "SarvamProxyFn"
type: lambda
tags: [#lambda, ingestion]
source: packages/backend/functions/sarvam-proxy/index.ts
related: ["[[sarvam-ai]]", "[[secrets-manager]]", "[[post-sarvam-proxy]]", "[[ingestion-stack]]"]
updated: 2026-06-20
---

# SarvamProxyFn

Server-side proxy for Sarvam AI STT and TTS APIs. Keeps the Sarvam API key out of mobile APKs.

**File:** `packages/backend/functions/sarvam-proxy/index.ts`
**Runtime:** Node.js 20.x, timeout 30s, memory 256 MB

## Routes

### POST /sarvam-proxy/stt
- Content-Type must be `multipart/form-data`
- Forwards raw body to `https://api.sarvam.ai/speech-to-text`
- Header: `API-Subscription-Key: <SARVAM_API_KEY>`
- Returns transcript JSON

### POST /sarvam-proxy/tts
- Body: `{ text (max 500 chars), target_language_code, speaker?, pitch?, pace? }`
- Defaults: `speaker='meera'`
- POST to `https://api.sarvam.ai/text-to-speech`
- Returns audio/wav JSON

## Env Vars

- `SARVAM_API_KEY` — from Secrets Manager `vigia/sarvam-api-key`

## Links

- [[sarvam-ai]] — external STT/TTS provider
- [[secrets-manager]] — Sarvam key source
- [[post-sarvam-proxy]] — API routes
- [[ingestion-stack]] — CDK construct owning this Lambda
