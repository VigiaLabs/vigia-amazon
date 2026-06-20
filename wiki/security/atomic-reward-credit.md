---
title: "Atomic Reward Credit (TransactWrite)"
type: security
tags: [#security, intelligence]
source: packages/backend/src/orchestrator/index.ts
related: ["[[orchestrator-fn]]", "[[cooldown-table]]", "[[rewards-ledger-table]]", "[[ledger-table]]", "[[reward-credit-flow]]"]
updated: 2026-06-20
---

# Atomic Reward Credit (TransactWrite)

DynamoDB `TransactWriteCommand` prevents double-crediting in distributed concurrent environments.

## Three-Item Transaction (orchestrator/index.ts:142)

```
Item 1: PUT CooldownTable
  Key: rwd#<wallet>#<geohash>
  ConditionExpression: attribute_not_exists(pk)   ← mutual exclusion
  TTL: now + 30 days

Item 2: UPDATE RewardsLedgerTable
  Key: wallet_address = <wallet>
  UpdateExpression: ADD pending_balance :amount, total_earned :amount

Item 3: PUT LedgerTable
  Key: ledgerId = <hazardId>
  payload: { hazardId, h3Index, epochDay, discovererPubkey, ... }
  SHA-256 hash chain entry
```

## Failure Semantics

`TransactionCanceledException` if any condition fails → entire transaction rolled back:
- Item 1 condition failure = double-credit attempt → `return false` (reward silently skipped)
- DynamoDB internal error → propagated up → hazard status stays PENDING (no status update on exception)

## Why Not Separate Writes?

- Separate reads + writes allow TOCTOU: two Lambda invocations could both see "no cooldown" and both credit.
- The TransactWrite makes the cooldown write and balance update atomic at the DynamoDB service layer.

## Links

- [[orchestrator-fn]] — calls `tryCreditReward()` which issues this TransactWrite
- [[cooldown-table]] — Item 1 (mutual exclusion key)
- [[rewards-ledger-table]] — Item 2 (balance ADD)
- [[ledger-table]] — Item 3 (hash chain entry)
- [[reward-credit-flow]] — end-to-end flow
