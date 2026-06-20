---
title: "AttestationFn"
type: lambda
tags: [#lambda, ingestion]
source: packages/backend/functions/attestation/index.ts
related: ["[[iot-core]]", "[[vigia-pi-device-registry]]", "[[hazards-table]]", "[[attestation-log-table]]", "[[ecdsa-p256-verify]]", "[[anti-replay-seq]]", "[[h3-geo-dedup]]", "[[ingestion-stack]]", "[[hazard-attestation-flow]]"]
updated: 2026-06-20
---

# AttestationFn

Hardware attestation pipeline for Raspberry Pi edge nodes. Triggered by AWS IoT Core topic rule `vigia_hazard_attest`.

**File:** `packages/backend/functions/attestation/index.ts`
**Runtime:** Node.js 20.x, timeout 30s, memory 512 MB, log retention 1 month

## Handler Logic (attestation/index.ts:260)

1. **Decode** (line 264) — Base64 decode → `@msgpack/msgpack` decode. Checks `payload.version === 1`.
2. **EtHashInput (96-byte struct) reconstruction** (lines 54-101) — Byte-precise layout:
   - `device_id[0:16]` — UUID hex stripped of dashes
   - `mcu_timestamp_us[16:24]` — uint64 LE
   - `sequence[24:28]` — uint32 LE
   - `q_w, q_x, q_y, q_z[28:44]` — float32 LE × 4 (quaternion)
   - `accel_x, accel_y, accel_z[44:56]` — float32 LE × 3
   - `imu_cal_status[56:60]` — uint8 + 3 pad
   - `lat, lon[60:76]` — float64 LE × 2
   - `alt_m, speed_ms, course_deg[76:88]` — float32 LE × 3
   - `gps_fix_type[88], satellites[89], pad[90:92]`
   - `hdop[92:96]` — float32 LE
3. **SHA-256 integrity** (lines 281-287) — `createHash('sha256').update(etInput)` compared to `se.et_hash`.
4. **ECDSA P-256 verify** (line 291) — `p256.verify(sigRaw, etHash, pubKey, {prehash:false, lowS:false})` via `@noble/curves`. Public key extracted from X.509 PEM cert (last 65 bytes of SPKI DER = uncompressed P-256 point).
5. **Anti-replay** (line 296) — `UpdateCommand` with `ConditionExpression: attribute_not_exists(last_seq) OR last_seq < :seq`. Called AFTER signature verify to prevent watermark poisoning.
6. **H3 geo-dedup + HazardsTable upsert** (lines 161-231) — `latLngToCell(lat, lon, 10)` (res-10 ≈ 15m). Queries `h3-hazardtype-index` GSI for existing entry within 24h window. UPDATEs if exists (increments `observation_count`), PUTs if new.
7. **Attestation log** (lines 235-250) — appends to `VigiaAttestationLog` (TTL 90 days).

## IoT Core Trigger Permission

```ts
attestationFn.addPermission('IoTCoreInvoke', {
  principal: new iam.ServicePrincipal('iot.amazonaws.com'),
  sourceArn: `arn:aws:iot:…:rule/vigia_hazard_attest`,
});
```

## Links

- [[iot-core]] — trigger (IoT Topic Rule)
- [[ecdsa-p256-verify]] — P-256 signature verification
- [[anti-replay-seq]] — sequence watermark mechanism
- [[h3-geo-dedup]] — spatial deduplication
- [[vigia-pi-device-registry]] — cert_pem + last_seq store
- [[hazards-table]] — upsert destination
- [[attestation-log-table]] — append-only verified event log
- [[hazard-attestation-flow]] — end-to-end flow
- [[ingestion-stack]] — CDK construct owning this Lambda
