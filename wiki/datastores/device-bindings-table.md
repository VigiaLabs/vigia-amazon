---
title: "DeviceBindingsTable"
type: datastore
tags: [#datastore, ingestion]
source: packages/infrastructure/lib/stacks/ingestion-stack.ts
related: ["[[claim-device-fn]]", "[[ingestion-stack]]"]
updated: 2026-06-20
---

# DeviceBindingsTable

Enforces 1:1 binding between Pi `device_id` and wallet `wallet_pubkey`. `removalPolicy: RETAIN`.

**CDK name:** `DeviceBindingsTable`

## Schema

| Attribute | Type | Description |
|---|---|---|
| `device_id` | String (PK) | Pi hardware UUID |
| `wallet_pubkey` | String | Solana wallet address |
| `bound_at` | String | ISO-8601 |

## GSI

| Index | PK |
|---|---|
| `wallet-pubkey-index` | `wallet_pubkey` |

Used by [[claim-device-fn]] for reverse-lookup: "does this wallet already own a different device?"

## Links

- [[claim-device-fn]] — Get + Query GSI + conditional Put
- [[ingestion-stack]] — CDK construct owning this table
