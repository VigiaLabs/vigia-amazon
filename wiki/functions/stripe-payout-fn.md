---
title: "StripePayoutFn"
type: lambda
tags: [#lambda, ingestion]
source: packages/backend/functions/stripe-payout/index.ts
related: ["[[rewards-ledger-table]]", "[[secrets-manager]]", "[[wallet-ownership-proof]]", "[[stripe]]", "[[post-stripe-routes]]", "[[ingestion-stack]]", "[[stripe-payout-flow]]"]
updated: 2026-06-20
---

# StripePayoutFn

VIGIA token → fiat payout via Stripe Connect Express. Three routes on a single Lambda.

**File:** `packages/backend/functions/stripe-payout/index.ts`
**Runtime:** Node.js 20.x, timeout 30s, memory 256 MB
**API version:** Stripe `2024-12-18.acacia`

## Routes

| Path ends with | Action |
|---|---|
| `/onboard-session` | `stripe.accounts.create({type:'express'})` + `stripe.accountLinks.create({type:'account_onboarding'})`. Persists `stripe_account_id` to RewardsLedgerTable. |
| `/payout-session` | Gets `pending_balance` from RewardsLedgerTable. Converts micro-VGA → USD cents (`pendingMicro / 1e6 * VGA_TO_USD_CENTS`). `stripe.paymentIntents.create(amount, 'us_bank_account', transfer_data.destination=stripeAccountId)`. Min payout: $1.00. |
| `/financial-session` | `stripe.financialConnections.sessions.create` for bank-account linking. |

## Security

All routes call `verifyWalletOwnership()` (lines 49-64): same `VIGIA-BALANCE:<wallet>:<tsMs>` Ed25519 proof as [[rewards-balance-fn]], 5-min freshness window.

## Env Vars

- `STRIPE_SECRET_KEY` — from Secrets Manager `vigia/stripe-secret-key`
- `STRIPE_PUBLISHABLE_KEY` — from Secrets Manager `vigia/stripe-publishable-key`
- `VGA_TO_USD_CENTS` — default `100` (1 VGA = $1.00)
- `REWARDS_LEDGER_TABLE_NAME` — injected by [[vigia-stack]] after IntelligenceStack creation

## Links

- [[stripe]] — external payment provider
- [[rewards-ledger-table]] — reads balance + writes stripe_account_id
- [[wallet-ownership-proof]] — authentication on all routes
- [[secrets-manager]] — Stripe key source
- [[post-stripe-routes]] — API routes
- [[stripe-payout-flow]] — end-to-end flow
- [[ingestion-stack]] — CDK construct owning this Lambda
