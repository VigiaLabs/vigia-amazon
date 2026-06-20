---
title: "POST /claim-device"
type: api-route
tags: [#api-route, ingestion]
source: packages/infrastructure/lib/stacks/ingestion-stack.ts
related: ["[[api-gateway-telemetry]]", "[[claim-device-fn]]"]
updated: 2026-06-20
---

# POST /claim-device

Binds a Pi hardware unit (device_id) to a wallet. One device → one wallet, enforced atomically.

**Lambda:** [[claim-device-fn]]

## Request Body

```json
{ "device_id": "<uuid>", "wallet_pubkey": "<base58>" }
```

## Responses

- `200 { status:'claimed' }` — successful or idempotent re-claim
- `409 { detail:'device_taken' }` or `409 { detail:'wallet_taken' }`

## Links

- [[claim-device-fn]] — handler
