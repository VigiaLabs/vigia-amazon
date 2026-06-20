---
title: "Hazard Attestation Flow (Pi)"
type: flow
tags: [#flow, ingestion]
source: packages/backend/functions/attestation/index.ts, packages/infrastructure/lib/stacks/ingestion-stack.ts
related: ["[[iot-core]]", "[[attestation-fn]]", "[[ecdsa-p256-verify]]", "[[anti-replay-seq]]", "[[h3-geo-dedup]]", "[[vigia-pi-device-registry]]", "[[hazards-table]]", "[[attestation-log-table]]"]
updated: 2026-06-20
---

# Hazard Attestation Flow (Pi Hardware)

End-to-end path for a Raspberry Pi edge node submitting a hardware-attested hazard observation.

## Steps

```
Pi (ATECC608A)
  │  Build 96-byte EtHashInput struct
  │  ATECC signs SHA-256(EtHashInput) → ECDSA P-256 sig
  │  MsgPack encode { payload, signature, et_hash, cert_pem }
  │  MQTT publish → vigia/attest/<device_id>/hazard
  ▼
AWS IoT Core
  │  Topic Rule: vigia_hazard_attest
  │  SQL: SELECT encode(*,'base64') AS payload, topic() AS topic, timestamp() AS ts
  │  Action: Lambda invoke → AttestationFn
  ▼
AttestationFn (packages/backend/functions/attestation/index.ts)
  │  Base64 decode + MsgPack decode
  │  Reconstruct EtHashInput (byte-precise, 96 bytes)
  │  SHA-256 integrity check vs payload.et_hash
  │  p256.verify(sig, etHash, pubKey)         ← ECDSA P-256
  │  UpdateCommand(last_seq) with ConditionExpression  ← anti-replay
  │  H3 dedup check (res-10) on h3-hazardtype-index GSI
  │  Upsert HazardsTable (new PENDING or increment observation_count)
  │  PutCommand to VigiaAttestationLog
  ▼
HazardsTable INSERT → DynamoDB Stream → EventBridge Pipe → OrchestratorFn
```

## Links

- [[iot-core]], [[attestation-fn]], [[ecdsa-p256-verify]], [[anti-replay-seq]], [[h3-geo-dedup]]
- [[vigia-pi-device-registry]], [[hazards-table]], [[attestation-log-table]]
- [[hazard-verification-flow]] — next in chain
