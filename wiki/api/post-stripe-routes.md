---
title: "POST /stripe/* routes"
type: api-route
tags: [#api-route, ingestion]
source: packages/infrastructure/lib/stacks/ingestion-stack.ts
related: ["[[api-gateway-telemetry]]", "[[stripe-payout-fn]]", "[[stripe]]", "[[stripe-payout-flow]]"]
updated: 2026-06-20
---

# POST /stripe/* Routes

Three Stripe Connect routes on [[api-gateway-telemetry]]:

| Path | Action |
|---|---|
| `POST /stripe/onboard-session` | Create Express account + return onboarding URL |
| `POST /stripe/payout-session` | Create PaymentIntent for fiat payout |
| `POST /stripe/financial-session` | Create Financial Connections session for bank linking |

**Lambda:** [[stripe-payout-fn]] (single Lambda handles all three via path suffix)

All routes require wallet ownership proof headers (see [[wallet-ownership-proof]]).

## Links

- [[stripe-payout-fn]], [[stripe]], [[stripe-payout-flow]]
