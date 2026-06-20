---
title: "Mobile Ingest Flow"
type: flow
tags: [#flow, ingestion]
source: packages/backend/src/validator/index.ts
related: ["[[validator-fn]]", "[[ed25519-verify]]", "[[vigia-device-registry]]", "[[s3-frames-bucket]]", "[[hazards-table]]", "[[api-gateway-telemetry]]", "[[post-telemetry]]", "[[orchestrator-fn]]", "[[hazard-verification-flow]]"]
updated: 2026-06-20
---

# Mobile Ingest Flow

End-to-end path for a mobile app user (Android/iOS) submitting a hazard observation.

## Steps

```
Mobile App (vigia-android)
  │  ONNX on-device inference → hazardType + confidence
  │  Ed25519 sign: "VIGIA:<type>:<lat>:<lon>:<ts>:<conf>[:<sha256>]"
  │  Optional: capture frame → SHA-256 bind → include frame_base64
  │  POST /telemetry { hazardType, lat, lon, confidence, timestamp,
  │                    wallet_address, signature [, frame_base64] }
  ▼
API Gateway (Telemetry, prod stage, 100 RPS throttle)
  ▼
ValidatorFn (packages/backend/src/validator/index.ts)
  │  Input validation (field types, ranges)
  │  Timestamp freshness check ±10 min
  │  Frame SHA-256 check (if present)
  │  nacl.sign.detached.verify(message, sig, pubkey)
  │  DeviceRegistryTable GetItem (not found / blacklisted → 403)
  │  ngeohash.encode(lat, lon, 7) → geohash
  │  If frame: S3 PutObject frames/<geohash>/<ts>.jpg
  │  HazardsTable PutItem { status:'PENDING', driverWalletAddress, s3_key, ttl }
  │  Return 202 { hazardId, status:'PENDING' }
  ▼
HazardsTable INSERT → DynamoDB Stream → EventBridge Pipe → OrchestratorFn
```

## Links

- [[post-telemetry]], [[api-gateway-telemetry]], [[validator-fn]]
- [[ed25519-verify]], [[vigia-device-registry]], [[s3-frames-bucket]]
- [[hazards-table]], [[orchestrator-fn]]
- [[hazard-verification-flow]] — next in chain
