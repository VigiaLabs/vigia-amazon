---
title: "VigiaAttestationLog"
type: datastore
tags: [#datastore, ingestion]
source: packages/infrastructure/lib/stacks/ingestion-stack.ts
related: ["[[attestation-fn]]", "[[ingestion-stack]]"]
updated: 2026-06-20
---

# VigiaAttestationLog

Append-only log of every successfully verified Pi ECDSA attestation.

**CDK name:** `VigiaAttestationLog` (`tableName: 'VigiaAttestationLog'` — fixed name, not auto-generated)

## Schema

| Attribute | Type | Description |
|---|---|---|
| `attestation_id` | String (PK) | UUID |
| `timestamp` | String (SK) | ISO-8601 |
| `device_id` | String | Pi hardware UUID |
| `h3_index` | String | H3 res-10 cell |
| `hazard_type` | String | Hazard classification |
| `et_hash` | String | Base64 SHA-256 of 96-byte EtHashInput |
| `sequence` | Number | Monotonic sequence from Pi |
| `ttl` | Number | Unix epoch (90-day lifecycle) |

## Links

- [[attestation-fn]] — PutCommand after ECDSA verify passes
- [[ingestion-stack]] — CDK construct owning this table
