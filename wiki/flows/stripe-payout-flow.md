---
title: "Stripe Payout Flow"
type: flow
tags: [#flow, ingestion]
source: packages/backend/functions/stripe-payout/index.ts
related: ["[[stripe-payout-fn]]", "[[rewards-ledger-table]]", "[[stripe]]", "[[wallet-ownership-proof]]", "[[post-stripe-routes]]"]
updated: 2026-06-20
---

# Stripe Payout Flow

User converts accumulated $VIGIA token balance to fiat via Stripe Connect Express.

## Steps

```
Mobile App / Web
  │  (First time only:) POST /stripe/onboard-session
  │    → Stripe account created, onboarding URL returned
  │    → User completes KYC on Stripe dashboard
  │
  │  POST /stripe/payout-session
  │    Headers: X-Wallet-Timestamp, X-Wallet-Signature
  ▼
StripePayoutFn
  │  verifyWalletOwnership() ← Ed25519 "VIGIA-BALANCE:<wallet>:<ts>"
  │  GetItem RewardsLedgerTable → pending_balance
  │  Convert: pendingMicro / 1e6 * VGA_TO_USD_CENTS = USD cents
  │  Check minimum ($1.00)
  │  stripe.paymentIntents.create({
  │    amount: usdCents, currency:'usd',
  │    payment_method_types:['us_bank_account'],
  │    transfer_data: { destination: stripeAccountId }
  │  })
  │  Return { clientSecret, amount }
  ▼
Stripe → bank transfer (ACH)
```

## Links

- [[stripe-payout-fn]], [[stripe]], [[rewards-ledger-table]]
- [[wallet-ownership-proof]], [[post-stripe-routes]]
