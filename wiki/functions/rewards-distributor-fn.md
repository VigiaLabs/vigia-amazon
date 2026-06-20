---
title: "RewardsDistributorFn"
type: lambda
tags: [#lambda, enterprise]
source: packages/backend/functions/enterprise/rewards-distributor.ts
related: ["[[burn-history-table]]", "[[enterprise-users-table]]", "[[hazards-table]]", "[[enterprise-stack]]", "[[enterprise-data-credit-flow]]"]
updated: 2026-06-20
---

# RewardsDistributorFn

Triggered by [[burn-history-table]] DynamoDB Stream (batch size 1, LATEST position). Distributes rewards when $VIGIA tokens are burned.

**Handler:** `rewards-distributor.handler`, **Runtime:** Node.js 20.x, timeout 30s

## IAM

`dynamodb:GetRecords`, `GetShardIterator`, `DescribeStream`, `ListStreams` on BurnHistoryTable stream ARN.

## Links

- [[burn-history-table]] — DynamoDB Stream trigger
- [[enterprise-users-table]], [[hazards-table]] — reads user + hazard data
- [[enterprise-data-credit-flow]] — end-to-end flow
- [[enterprise-stack]] — CDK construct owning this Lambda
