---
title: "ECDSA P-256 Hardware Verify"
type: security
tags: [#security, ingestion]
source: packages/backend/functions/attestation/index.ts
related: ["[[attestation-fn]]", "[[vigia-pi-device-registry]]", "[[anti-replay-seq]]", "[[iot-core]]", "[[hazard-attestation-flow]]"]
updated: 2026-06-20
---

# ECDSA P-256 Hardware Verify

Hardware attestation using ATECC608A secure element on Raspberry Pi. Signature is ECDSA P-256 (secp256r1) over a 96-byte EtHashInput struct pre-hashed with SHA-256.

**Library:** `@noble/curves` (p256 module) — constant-time, zero dependency
**Parameters:** `prehash:false, lowS:false` (matches ATECC608A output exactly)

## Verification Flow (attestation/index.ts:291)

```
etInput  = buildEtHashInput(payload)          // 96-byte struct (byte-precise layout)
etHash   = SHA-256(etInput)                   // 32-byte digest
pubKey   = X509_SPKI_to_P256_point(cert_pem) // last 65 bytes of SPKI DER
verified = p256.verify(sig_raw, etHash, pubKey, {prehash:false, lowS:false})
```

`cert_pem` is read from [[vigia-pi-device-registry]]. The signature (`se.signature`) and hash (`se.et_hash`) come from the MsgPack payload.

## EtHashInput Layout (96 bytes)

| Offset | Length | Field |
|---|---|---|
| 0 | 16 | device_id (UUID hex no-dashes) |
| 16 | 8 | mcu_timestamp_us (uint64 LE) |
| 24 | 4 | sequence (uint32 LE) |
| 28 | 16 | quaternion q_w,q_x,q_y,q_z (float32 LE ×4) |
| 44 | 12 | accel_x,y,z (float32 LE ×3) |
| 56 | 4 | imu_cal_status (uint8 + 3 pad) |
| 60 | 16 | lat, lon (float64 LE ×2) |
| 76 | 12 | alt_m, speed_ms, course_deg (float32 LE ×3) |
| 88 | 4 | gps_fix_type, satellites, pad×2 |
| 92 | 4 | hdop (float32 LE) |

## SHA-256 Integrity Check

Before `p256.verify`, the Lambda recomputes `SHA-256(etInput)` and compares it to `payload.et_hash` (the hash pre-computed on-device before ATECC signs). Mismatch → early reject.

## Links

- [[attestation-fn]] — runs this verification pipeline
- [[vigia-pi-device-registry]] — stores `cert_pem` and `last_seq`
- [[anti-replay-seq]] — next security layer after sig verify
- [[hazard-attestation-flow]] — end-to-end flow
