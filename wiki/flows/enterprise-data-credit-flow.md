---
title: "Enterprise Data Credit Flow"
type: flow
tags: [#flow, enterprise]
source: packages/backend/functions/enterprise/burn.ts
related: ["[[enterprise-burn-fn]]", "[[burn-history-table]]", "[[rewards-distributor-fn]]", "[[cognito-user-pool]]"]
updated: 2026-06-20
---

# Enterprise Data Credit Flow

Enterprise customers burn $VIGIA tokens to obtain Data Credits (bandwidth/API access).

## Steps

```
Enterprise Client (JWT-authenticated)
  │  POST /enterprise/burn { tokenAmount, wallet }
  ▼
EnterpriseBurnFn (Cognito JWT required)
  │  PutItem BurnHistoryTable { burnId, userId, tokenAmount,
  │                              dataCreditsGranted, timestamp }
  ▼
BurnHistoryTable DynamoDB Stream (NEW_IMAGE, batch=1, LATEST)
  ▼
RewardsDistributorFn
  │  Reads burn record
  │  Updates user data credit balance
  │  Optional: Triggers reward distribution to hazard contributors
```

## Links

- [[enterprise-burn-fn]], [[burn-history-table]], [[rewards-distributor-fn]]
- [[cognito-user-pool]], [[enterprise-api-routes]]
