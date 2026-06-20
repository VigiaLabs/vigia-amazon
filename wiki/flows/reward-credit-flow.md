---
title: "Reward Credit Flow"
type: flow
tags: [#flow, intelligence]
source: packages/backend/src/orchestrator/index.ts
related: ["[[orchestrator-fn]]", "[[atomic-reward-credit]]", "[[cooldown-table]]", "[[rewards-ledger-table]]", "[[ledger-table]]", "[[stripe-payout-flow]]"]
updated: 2026-06-20
---

# Reward Credit Flow

Atomic off-chain $VIGIA token credit for a verified hazard submission.

## Steps

```
OrchestratorFn: verdict = VERIFIED
  │
  └─ tryCreditReward(walletAddress, geohash, hazardId)
       DynamoDB TransactWriteCommand (all-or-nothing):
         1. PUT CooldownTable key=rwd#<wallet>#<geohash>
            ConditionExpression: attribute_not_exists(pk)   ← mutual exclusion
            TTL: +30 days
         2. UPDATE RewardsLedgerTable
            ADD pending_balance 1000000000000000000 (1e18 micro-VGA)
            ADD total_earned    1000000000000000000
         3. PUT LedgerTable
            ledgerId=hazardId, SHA-256 hash chain entry
       TransactionCanceledException → return false (double-credit prevented)
       true → reward credited
```

## Downstream

Credit accumulates in `pending_balance`. User triggers payout via [[stripe-payout-flow]]:
`POST /stripe/payout-session` → Stripe PaymentIntent → fiat to bank.

## Links

- [[orchestrator-fn]], [[atomic-reward-credit]]
- [[cooldown-table]], [[rewards-ledger-table]], [[ledger-table]]
- [[stripe-payout-flow]] — downstream fiat conversion
