---
title: "Wallet Ownership Proof"
type: security
tags: [#security, intelligence]
source: packages/backend/functions/rewards-balance/index.ts
related: ["[[rewards-balance-fn]]", "[[stripe-payout-fn]]", "[[ed25519-verify]]", "[[rewards-ledger-table]]"]
updated: 2026-06-20
---

# Wallet Ownership Proof

Anti-phishing mechanism ensuring only the true wallet holder can read their balance or trigger a payout. Uses the same Ed25519 keypair as telemetry signing.

## Protocol (rewards-balance/index.ts:34)

```
Message  : "VIGIA-BALANCE:<wallet_address>:<unix_timestamp_ms>"
Signature: X-Wallet-Signature header (base58 Ed25519, 64 bytes)
Timestamp: X-Wallet-Timestamp header (Unix ms integer)

Freshness: |now_ms - tsMs| <= 5 * 60 * 1000   (5-minute window)
```

If stale → `401 { error:'STALE_TIMESTAMP' }`.
If invalid sig → `401 { error:'INVALID_SIGNATURE' }`.

## Why This Matters

Without ownership proof, any party knowing a wallet address could:
- Enumerate balances of all known wallets
- Trigger Stripe payouts to their own Stripe account

The 5-minute window limits replay attacks. The timestamp is included in the signed payload so pre-signing an arbitrary timestamp is ineffective.

## Links

- [[rewards-balance-fn]] — implements this check before GetItem
- [[stripe-payout-fn]] — same check before all payout routes
- [[ed25519-verify]] — underlying primitive
- [[rewards-ledger-table]] — protected resource
