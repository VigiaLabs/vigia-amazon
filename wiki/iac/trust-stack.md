---
title: "TrustStack"
type: iac
tags: [#iac]
source: packages/infrastructure/lib/stacks/trust-stack.ts
related: ["[[ledger-table]]", "[[vigia-stack]]"]
updated: 2026-06-20
---

# TrustStack

Minimal CDK Construct for the DePIN ledger. Single table with DynamoDB Streams.

**File:** `packages/infrastructure/lib/stacks/trust-stack.ts`

## Resources Owned

**Table:** [[ledger-table]] (PK: `ledgerId`, SK: `timestamp`, Stream: NEW_IMAGE)

## Links

- [[ledger-table]] — owned resource
- [[vigia-stack]] — instantiates this first (no deps)
