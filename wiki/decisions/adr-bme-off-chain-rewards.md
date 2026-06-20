---
title: "ADR: Off-Chain Pending Balance"
type: decision
tags: [#decision, intelligence]
source: packages/backend/src/orchestrator/index.ts, packages/backend/functions/rewards-balance/index.ts
related: ["[[rewards-ledger-table]]", "[[atomic-reward-credit]]", "[[solana-anchor]]", "[[stripe-payout-flow]]"]
updated: 2026-06-20
---

# ADR: Off-Chain Pending Balance vs Direct On-Chain Mint

## Context

When a hazard is VERIFIED, the contributor should receive $VIGIA tokens. Options:
1. Directly call `mint_to` on Solana Anchor program per verification.
2. Accumulate credits in DynamoDB (`pending_balance`) and mint on payout.

## Decision

Use option 2: off-chain `pending_balance` in [[rewards-ledger-table]]. Solana `submitHazardToChain` is non-blocking and records the hazard event (not the token mint) on-chain. Fiat payout via Stripe is the primary redemption path for this phase.

## Rationale

- **Latency:** Solana `sendTransaction` + `confirmTransaction('confirmed')` adds 500ms-2s to each verification. Non-blocking fire-and-forget keeps orchestrator fast.
- **Gas fees:** Minting per verification at DePIN scale generates high cumulative Solana fees.
- **Atomic DynamoDB credit:** DynamoDB TransactWrite (see [[atomic-reward-credit]]) is lower-latency and more predictable than Solana transaction finality for the reward accounting step.
- **Stripe integration:** The primary exit ramp for VIGIA rewards is Stripe Connect fiat payout, not Solana token transfer.

## Consequences

- `pending_balance` in DynamoDB is the authoritative off-chain balance.
- On-chain state records hazard events, not individual token balances.
- On-chain mint (if desired) would be a future batch operation over `pending_balance`.

## Links

- [[rewards-ledger-table]], [[atomic-reward-credit]], [[solana-anchor]], [[stripe-payout-flow]]
