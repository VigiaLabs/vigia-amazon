---
title: "ClaimDeviceFn"
type: lambda
tags: [#lambda, ingestion]
source: packages/backend/functions/claim-device/index.ts
related: ["[[device-bindings-table]]", "[[post-claim-device]]", "[[ingestion-stack]]"]
updated: 2026-06-20
---

# ClaimDeviceFn

Enforces 1:1 binding between a Pi hardware unit (`device_id`) and a wallet (`wallet_pubkey`). Both exclusivity constraints are bi-directional:
- One `device_id` → exactly one `wallet_pubkey`
- One `wallet_pubkey` → exactly one `device_id`

**File:** `packages/backend/functions/claim-device/index.ts`
**Runtime:** Node.js 20.x, timeout 10s

## Handler Logic (claim-device/index.ts:28)

1. `GetCommand` on DeviceBindingsTable by `device_id`. If exists:
   - Same `wallet_pubkey` → idempotent 200 OK.
   - Different `wallet_pubkey` → 409 `{"detail":"device_taken"}`.
2. `QueryCommand` on `wallet-pubkey-index` GSI. If wallet owns a different device → 409 `{"detail":"wallet_taken"}`.
3. **Atomic write** (line 69): `PutCommand` with `ConditionExpression: attribute_not_exists(device_id)`. Catches `ConditionalCheckFailedException` (write race) → 409 `device_taken`.

## Links

- [[device-bindings-table]] — 1:1 binding store
- [[post-claim-device]] — API route
- [[ingestion-stack]] — CDK construct owning this Lambda
