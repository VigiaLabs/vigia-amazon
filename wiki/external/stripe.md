---
title: "Stripe"
type: external
tags: [#external, payments]
source: packages/backend/functions/stripe-payout/index.ts
related: ["[[stripe-payout-fn]]", "[[secrets-manager]]", "[[rewards-ledger-table]]", "[[stripe-payout-flow]]", "[[ingestion-stack]]"]
updated: 2026-06-20
---

# Stripe

External payment provider for fiat payouts of VIGIA token rewards.

**SDK:** `stripe` npm package v22.2.2, API version `2024-12-18.acacia`
**Account type:** Stripe Connect Express

## Integration Points

| API Call | Route | Description |
|---|---|---|
| `stripe.accounts.create({type:'express'})` | POST /stripe/onboard-session | Creates Express sub-account |
| `stripe.accountLinks.create({type:'account_onboarding'})` | POST /stripe/onboard-session | Returns onboarding URL |
| `stripe.paymentIntents.create` | POST /stripe/payout-session | Amount in USD cents, transfer_data.destination = Express account |
| `stripe.financialConnections.sessions.create` | POST /stripe/financial-session | Bank account linking |

## Currency Conversion

`pendingMicro / 1e6 * VGA_TO_USD_CENTS` (default 100 = $1.00 per VGA).
Minimum payout: $1.00 (100 cents). Below minimum → `400 MIN_PAYOUT`.

## Keys

Stored in [[secrets-manager]]:
- `vigia/stripe-secret-key` → `STRIPE_SECRET_KEY` env var
- `vigia/stripe-publishable-key` → `STRIPE_PUBLISHABLE_KEY` env var

## Links

- [[stripe-payout-fn]] — sole consumer
- [[secrets-manager]] — key storage
- [[rewards-ledger-table]] — balance source + stripe_account_id storage
- [[stripe-payout-flow]] — end-to-end flow
