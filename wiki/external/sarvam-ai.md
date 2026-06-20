---
title: "Sarvam AI"
type: external
tags: [#external, ai]
source: packages/backend/functions/sarvam-proxy/index.ts
related: ["[[sarvam-proxy-fn]]", "[[secrets-manager]]", "[[ingestion-stack]]"]
updated: 2026-06-20
---

# Sarvam AI

Indian-language speech-to-text (STT) and text-to-speech (TTS) provider. Used for Bharat-language accessibility in the VIGIA mobile app.

**Base URL:** `https://api.sarvam.ai`
**Auth:** `API-Subscription-Key: <key>` header

## Endpoints

| Path | Method | Description |
|---|---|---|
| `/speech-to-text` | POST multipart/form-data | Transcript from audio |
| `/text-to-speech` | POST JSON | Audio from text + language + speaker |

## TTS Request

```json
{
  "inputs": ["<text up to 500 chars>"],
  "target_language_code": "hi-IN",
  "speaker": "meera"
}
```
Returns `audio/wav` base64 JSON.

## Key Storage

`vigia/sarvam-api-key` in [[secrets-manager]] → `SARVAM_API_KEY` env var in [[sarvam-proxy-fn]].

## Links

- [[sarvam-proxy-fn]] — sole API consumer (key-hiding proxy)
- [[secrets-manager]] — key storage
