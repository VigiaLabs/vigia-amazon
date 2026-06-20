---
title: "PiDeviceRegistryTable"
type: datastore
tags: [#datastore, ingestion]
source: packages/infrastructure/lib/stacks/ingestion-stack.ts
related: ["[[attestation-fn]]", "[[anti-replay-seq]]", "[[ecdsa-p256-verify]]", "[[ingestion-stack]]"]
updated: 2026-06-20
---

# PiDeviceRegistryTable

Stores Pi hardware unit certificates and anti-replay sequence watermarks. `removalPolicy: RETAIN`.

**CDK name:** `PiDeviceRegistryTable`

## Schema

| Attribute | Type | Description |
|---|---|---|
| `device_id` | String (PK) | UUID hex (matches EtHashInput bytes 0-16) |
| `cert_pem` | String | X.509 PEM certificate (SPKI contains P-256 public key) |
| `last_seq` | Number | Anti-replay monotonic watermark |
| `registered_at` | String | ISO-8601 |
| `device_status` | String | ACTIVE / SUSPENDED |

## Anti-Replay Pattern

`AttestationFn` performs a conditional `UpdateCommand`:
```
ConditionExpression: 'attribute_not_exists(last_seq) OR last_seq < :seq'
ExpressionAttributeValues: { ':seq': sequence }
UpdateExpression: 'SET last_seq = :seq'
```
This runs AFTER ECDSA verify to prevent watermark poisoning via forged seqs.

## Links

- [[attestation-fn]] — reads cert_pem for P-256 verify; updates last_seq
- [[anti-replay-seq]] — describes this mechanism
- [[ecdsa-p256-verify]] — cert_pem parsed here to extract P-256 point
- [[ingestion-stack]] — CDK construct owning this table
