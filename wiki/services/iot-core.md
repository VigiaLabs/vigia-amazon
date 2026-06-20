---
title: "AWS IoT Core"
type: aws-service
tags: [#aws-service, ingestion, hardware]
source: packages/infrastructure/lib/stacks/ingestion-stack.ts
related: ["[[attestation-fn]]", "[[vigia-pi-device-registry]]", "[[hazards-table]]", "[[adr-iot-core-replaces-fastapi]]", "[[ingestion-stack]]"]
updated: 2026-06-19
---

# AWS IoT Core

Central MQTT broker that receives hardware attestation messages from Raspberry Pi edge nodes.

## Role in Pipeline

Replaces the previous Mosquitto MQTT broker + FastAPI attestation server. Every Pi device publishes to IoT Core via TLS using its ATECC608A X.509 certificate; IoT Core Topic Rules route the messages to Lambda without any always-on server.

## Topic Rule: `vigia_hazard_attest`

**SQL:**
```sql
SELECT encode(*, 'base64') AS payload, topic() AS topic, timestamp() AS ts
FROM 'vigia/attest/+/hazard'
```

- Base64-encodes the raw MsgPack bytes so Lambda receives a JSON-serializable event
- `topic()` captures the device ID from the topic path (e.g. `vigia/attest/vigia-001/hazard`)
- `timestamp()` provides millisecond-precision IoT Core server time

**Action:** Invokes [[attestation-fn]] (Lambda) synchronously.

**Error action:** Logs failed rule evaluations to CloudWatch `/vigia/iot/attest-errors`.

## IoT Device Policy (`vigia-pi-device-policy`)

Each Pi's X.509 certificate is attached to this policy:
- `iot:Connect` — only to `client/${iot:ClientId}` (device can only connect as itself)
- `iot:Publish` — only to `vigia/attest/${iot:ClientId}/hazard` (own topic only)
- `iot:Publish` — only to `vigia/status/${iot:ClientId}/health` (last-will)

This prevents cross-device impersonation: a compromised Pi cannot publish as another device.

## Links

- Publishes to → [[attestation-fn]]
- Device certs stored in → [[vigia-pi-device-registry]]
- Verified events land in → [[hazards-table]]
- Defined in CDK → [[ingestion-stack]]
- Replaced Mosquitto: see → [[adr-iot-core-replaces-fastapi]]
