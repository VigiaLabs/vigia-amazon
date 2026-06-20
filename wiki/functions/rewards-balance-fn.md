---
title: "RewardsBalanceFn"
type: lambda
tags: [#lambda, intelligence]
source: packages/backend/functions/rewards-balance/index.ts
related: ["[[rewards-ledger-table]]", "[[wallet-ownership-proof]]", "[[ed25519-verify]]", "[[get-rewards-balance]]", "[[intelligence-stack]]", "[[stripe-payout-fn]]"]
updated: 2026-06-20
---

# RewardsBalanceFn

Read-only wallet balance query, gated by Ed25519 wallet ownership proof.

**File:** `packages/backend/functions/rewards-balance/index.ts`
**Runtime:** Node.js 20.x, timeout 10s, memory 128 MB

## Handler Logic (rewards-balance/index.ts:20)

1. Reads `wallet_address` from query string.
2. **Ownership proof** (lines 34-57):
   - Headers: `X-Wallet-Timestamp` (Unix ms) + `X-Wallet-Signature` (base58 Ed25519 sig)
   - Freshness: `|Date.now() - tsMs| > 5 min` → 401 `STALE_TIMESTAMP`
   - `nacl.sign.detached.verify(message, sigBytes, pubBytes)` where `message = "VIGIA-BALANCE:<wallet>:<tsMs>"`
3. `GetCommand` on RewardsLedgerTable.
4. Returns: `{wallet_address, pending_balance, total_earned, total_claimed, nonce, last_hazard_id}` (all BigInt-safe strings).

## Links

- [[rewards-ledger-table]] — reads balance
- [[wallet-ownership-proof]] — anti-phishing ownership proof
- [[ed25519-verify]] — underlying verify primitive
- [[get-rewards-balance]] — API route
- [[stripe-payout-fn]] — uses same ownership proof for payout
- [[intelligence-stack]] — CDK construct owning this Lambda
