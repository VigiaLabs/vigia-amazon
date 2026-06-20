---
title: "RewardsLedgerTable"
type: datastore
tags: [#datastore, intelligence]
source: packages/infrastructure/lib/stacks/intelligence-stack.ts
related: ["[[orchestrator-fn]]", "[[verify-hazard-sync-fn]]", "[[rewards-balance-fn]]", "[[stripe-payout-fn]]", "[[atomic-reward-credit]]", "[[intelligence-stack]]"]
updated: 2026-06-20
---

# RewardsLedgerTable

Off-chain pending $VIGIA balance ledger per wallet address.

**CDK name:** `RewardsLedgerTable`

## Schema

| Attribute | Type | Description |
|---|---|---|
| `wallet_address` | String (PK) | Solana base58 address |
| `pending_balance` | Number | Off-chain micro-VGA (1 VGA = 1e18 micro-VGA) |
| `total_earned` | Number | Cumulative lifetime earned |
| `total_claimed` | Number | Cumulative paid out via Stripe |
| `nonce` | Number | Prevents replay on balance proof |
| `last_hazard_id` | String | Most recent credited hazardId |
| `stripe_account_id` | String | Optional Stripe Connect Express account |

## Credit Pattern

`orchestrator-fn:tryCreditReward()`:
```
ADD pending_balance :amount, total_earned :amount
```
Part of atomic `TransactWriteCommand` (see [[atomic-reward-credit]]).

## Links

- [[orchestrator-fn]] — ADD credit via TransactWrite
- [[verify-hazard-sync-fn]] — ADD credit (non-atomic UpdateCommand)
- [[rewards-balance-fn]] — GetCommand for balance read
- [[stripe-payout-fn]] — reads pending_balance for payout amount; writes stripe_account_id
- [[atomic-reward-credit]] — full TransactWrite mechanism
- [[intelligence-stack]] — CDK construct owning this table
