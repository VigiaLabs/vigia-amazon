---
title: "SessionStack"
type: iac
tags: [#iac]
source: packages/infrastructure/lib/stacks/session-stack.ts
related: ["[[api-gateway-session]]", "[[session-crud-fn]]", "[[geohash-resolver-fn]]", "[[hash-chain-validator-fn]]", "[[places-search-fn]]", "[[session-files-table]]", "[[ledger-entries-table]]", "[[location-service]]", "[[vigia-stack]]"]
updated: 2026-06-20
---

# SessionStack

AWS CDK Construct for Map-as-a-File-System session management with geospatial and hash-chain features.

**File:** `packages/infrastructure/lib/stacks/session-stack.ts`

## Resources Owned

**Tables:** [[session-files-table]], [[ledger-entries-table]] (both RETAIN)

**Lambdas:** [[session-crud-fn]], [[geohash-resolver-fn]], [[hash-chain-validator-fn]], [[places-search-fn]]

**API:** [[api-gateway-session]] (REST API, `prod` stage)

## Links

- [[vigia-stack]] — instantiates this
- [[location-service]] — used by geohash resolver + places search
