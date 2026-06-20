---
title: "ValidatorFn"
type: lambda
tags: [#lambda, ingestion]
source: packages/backend/src/validator/index.ts
related: ["[[hazards-table]]", "[[vigia-device-registry]]", "[[s3-frames-bucket]]", "[[orchestrator-fn]]", "[[ed25519-verify]]", "[[post-telemetry]]", "[[ingestion-stack]]", "[[mobile-ingest-flow]]"]
updated: 2026-06-20
---

# ValidatorFn

Entry point for mobile hazard telemetry. Performs Ed25519 signature verification and writes a PENDING hazard to DynamoDB.

**File:** `packages/backend/src/validator/index.ts`
**Runtime:** Node.js 20.x, timeout 10s

## Handler Logic (validator/index.ts:20)

1. **Input validation** (lines 30-37) — checks hazardType, lat, lon, confidence, timestamp types and ranges. Values never mutated: Ed25519 sig covers exact wire values.
2. **Timestamp freshness** (line 44) — `±10 min` replay window. Accepts both ms and s timestamps (auto-detected at line 42).
3. **Frame integrity** (lines 50-57) — if `frame_base64` present: SHA-256 of frame bytes included in signed message, preventing MITM frame swap.
4. **Ed25519 verify** (line 70) — `nacl.sign.detached.verify(message, sigBytes, pubkeyBytes)`. Message format: `VIGIA:<type>:<lat>:<lon>:<ts>:<conf>[:<sha256>]`.
5. **Device registry check** (lines 76-86) — `GetCommand` on DeviceRegistryTable. Rejects if not found or `blacklisted===true`.
6. **Geohash + S3** — `ngeohash.encode(lat, lon, 7)`. If frame: `PutObjectCommand` to `frames/<geohash>/<timestamp>.jpg`.
7. **PENDING write** (line 104) — `PutCommand` to HazardsTable: `status: 'PENDING'`, `driverWalletAddress: publicKey`, `s3_key`, 30-day TTL.
8. Returns `202 { hazardId, status: 'PENDING' }`.

## IAM

- HazardsTable: `grantWriteData`
- DeviceRegistryTable: `grantReadData`
- HazardFramesBucket: `grantPut`

## Links

- [[ed25519-verify]] — signature verification mechanism
- [[hazards-table]] — writes PENDING hazard
- [[vigia-device-registry]] — device lookup + blacklist check
- [[s3-frames-bucket]] — optional frame upload
- [[orchestrator-fn]] — downstream via DynamoDB Stream → EventBridge Pipe
- [[post-telemetry]] — API route
- [[mobile-ingest-flow]] — end-to-end flow
- [[ingestion-stack]] — CDK construct owning this Lambda
