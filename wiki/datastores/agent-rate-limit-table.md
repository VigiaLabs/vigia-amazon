---
title: "AgentRateLimitTable"
type: datastore
tags: [#datastore, innovation]
source: packages/infrastructure/lib/stacks/innovation-stack.ts
related: ["[[innovation-stack]]"]
updated: 2026-06-20
---

# AgentRateLimitTable

IP-level rate limiting for Innovation API routes.

**CDK name:** `AgentRateLimitTable`, TTL attribute: `ttl`

## Schema

| Attribute | Type | Description |
|---|---|---|
| `ip` | String (PK) | Source IP |
| `windowStart` | String (SK) | Time window ISO-8601 |
| `count` | Number | Request count in window |
| `ttl` | Number | Unix epoch (window expiry) |

## Links

- [[innovation-stack]] — CDK construct owning this table
