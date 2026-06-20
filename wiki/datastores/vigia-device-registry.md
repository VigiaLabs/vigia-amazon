---
title: "DeviceRegistryTable (Mobile)"
type: datastore
tags: [#datastore, ingestion]
source: packages/infrastructure/lib/stacks/ingestion-stack.ts
related: ["[[register-device-fn]]", "[[validator-fn]]", "[[slash-node-fn]]", "[[ed25519-verify]]", "[[ingestion-stack]]"]
updated: 2026-06-20
---

# DeviceRegistryTable (Mobile)

Stores mobile wallet registrations. `removalPolicy: RETAIN`.

**CDK name:** `DeviceRegistryTable`

## Schema

| Attribute | Type | Description |
|---|---|---|
| `device_address` | String (PK) | base58 Solana wallet address |
| `registered_at` | String | ISO-8601 |
| `blacklisted` | Boolean | Set by [[slash-node-fn]] on sybil detection |
| `slashed_at` | String | Optional ISO-8601 |
| `slash_reason` | String | Optional VLM reasoning |
| `slash_tx` | String | Optional Solana tx signature |

## Links

- [[register-device-fn]] — conditional PutItem (attribute_not_exists)
- [[validator-fn]] — GetItem to check blacklisted flag
- [[slash-node-fn]] — UpdateItem SET blacklisted=true
- [[ed25519-verify]] — verify used at registration time
- [[ingestion-stack]] — CDK construct owning this table
