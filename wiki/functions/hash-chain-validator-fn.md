---
title: "HashChainValidatorFn"
type: lambda
tags: [#lambda, session]
source: packages/backend/src/ledger/validator.ts
related: ["[[ledger-entries-table]]", "[[session-api-routes]]", "[[session-stack]]"]
updated: 2026-06-20
---

# HashChainValidatorFn

Verifies SHA-256 hash chain integrity for a session's ledger entries. Returns `{valid, entries}` or `{valid:false, brokenAt, reason}`.

**File:** `packages/backend/src/ledger/validator.ts`
**Runtime:** Node.js 20.x, timeout 10s

## Validation Logic

For each entry in order:
1. Recomputes `SHA-256(timestamp + sessionId + action + previousHash + contributorId)`.
2. Compares to `currentHash`. Mismatch → `{valid:false, brokenAt:i, reason:'Hash mismatch'}`.
3. Checks `entries[i].previousHash === entries[i-1].currentHash`. First entry must have `previousHash='genesis'`.

## Links

- [[ledger-entries-table]] — reads ordered ledger entries
- [[session-api-routes]] — GET /sessions/{sessionId}/validate
- [[session-stack]] — CDK construct owning this Lambda
