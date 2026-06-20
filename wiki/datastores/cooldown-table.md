---
title: "CooldownTable"
type: datastore
tags: [#datastore, intelligence]
source: packages/infrastructure/lib/stacks/intelligence-stack.ts
related: ["[[orchestrator-fn]]", "[[atomic-reward-credit]]", "[[intelligence-stack]]"]
updated: 2026-06-20
---

# CooldownTable

Two-purpose deduplication table:
1. **Processing dedup** (30s TTL): `proc#<geohash>#<timestamp>` — prevents re-processing a DynamoDB stream event
2. **Reward dedup** (30-day TTL): `rwd#<wallet>#<geohash>` — prevents double-crediting same wallet for same area

**CDK name:** `CooldownTable`, TTL attribute: `ttl`

## Schema

| Attribute | Type | Description |
|---|---|---|
| `pk` | String (PK) | `proc#<geohash>#<ts>` or `rwd#<wallet>#<geohash>` |
| `ttl` | Number | Unix epoch (30s or 30-day) |

The reward dedup PutItem uses `ConditionExpression: attribute_not_exists(pk)` inside [[atomic-reward-credit]] TransactWrite. If this condition fails, the entire transaction is cancelled → no credit.

## Links

- [[orchestrator-fn]] — writes both processing and reward cooldowns
- [[atomic-reward-credit]] — reward dedup is item #1 in TransactWrite
- [[intelligence-stack]] — CDK construct owning this table
