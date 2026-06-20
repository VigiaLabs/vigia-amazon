---
title: "POST /register-device"
type: api-route
tags: [#api-route, ingestion]
source: packages/infrastructure/lib/stacks/ingestion-stack.ts
related: ["[[api-gateway-telemetry]]", "[[register-device-fn]]", "[[mobile-ingest-flow]]"]
updated: 2026-06-20
---

# POST /register-device

Self-registration of a Solana wallet as a VIGIA mobile device. Must be called before POST /telemetry.

**API:** [[api-gateway-telemetry]], stage `prod`
**Lambda:** [[register-device-fn]]

## Request Body

```json
{
  "device_address": "<base58 Solana pubkey>",
  "signature": "<base58 Ed25519 sig of 'VIGIA-REGISTER:<device_address>'>"
}
```

## Response

`201 { status:'registered' }` or `200 { status:'already_registered' }`.

## Links

- [[register-device-fn]] — handler
- [[mobile-ingest-flow]] — prerequisite step
