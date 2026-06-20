---
title: "RegisterDeviceFn"
type: lambda
tags: [#lambda, ingestion]
source: packages/backend/functions/register-device/index.ts
related: ["[[vigia-device-registry]]", "[[ed25519-verify]]", "[[wallet-ownership-proof]]", "[[post-register-device]]", "[[ingestion-stack]]", "[[mobile-ingest-flow]]"]
updated: 2026-06-20
---

# RegisterDeviceFn

Mobile wallet self-registration with Ed25519 proof-of-possession. Prevents registering wallets the caller does not control (Sybil identity farming).

**File:** `packages/backend/functions/register-device/index.ts`
**Runtime:** Node.js 20.x, timeout 10s

## Handler Logic (register-device/index.ts:20)

1. Validates `device_address` format: base58, 32-44 chars (line 27).
2. Requires `signature` field (line 35).
3. **Ed25519 proof-of-possession** (lines 40-48):
   ```
   message = "VIGIA-REGISTER:<device_address>"
   msg     = TextEncoder.encode(message)
   sigB    = bs58.decode(signature)      // 64 bytes
   pubB    = bs58.decode(device_address) // 32 bytes
   ok      = nacl.sign.detached.verify(msg, sigB, pubB)
   ```
4. **Idempotent write** (line 56): `PutCommand` with `ConditionExpression: attribute_not_exists(device_address)`. Returns `201 registered` or `200 already_registered`.

## IAM

- DeviceRegistryTable: `grantWriteData`

## Links

- [[vigia-device-registry]] — writes registration record
- [[ed25519-verify]] — proof-of-possession verification
- [[wallet-ownership-proof]] — same signing pattern extended for balance/payout
- [[post-register-device]] — API route
- [[mobile-ingest-flow]] — prerequisite for telemetry submission
- [[ingestion-stack]] — CDK construct owning this Lambda
