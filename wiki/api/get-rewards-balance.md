---
title: "GET /rewards-balance"
type: api-route
tags: [#api-route, intelligence]
source: packages/infrastructure/lib/vigia-stack.ts
related: ["[[api-gateway-telemetry]]", "[[rewards-balance-fn]]", "[[rewards-ledger-table]]", "[[wallet-ownership-proof]]"]
updated: 2026-06-20
---

# GET /rewards-balance

Returns pending and total $VIGIA token balance for a wallet. Gated by Ed25519 ownership proof headers.

**Lambda:** [[rewards-balance-fn]], added via [[vigia-stack]] cross-stack route

## Query Params

`?wallet_address=<base58>`

## Required Headers

```
X-Wallet-Timestamp: <unix_ms>
X-Wallet-Signature: <base58 Ed25519 of "VIGIA-BALANCE:<wallet>:<tsMs>">
```

## Links

- [[rewards-balance-fn]], [[rewards-ledger-table]], [[wallet-ownership-proof]]
