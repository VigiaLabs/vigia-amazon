---
title: "BurnHistoryTable"
type: datastore
tags: [#datastore, enterprise]
source: packages/infrastructure/lib/stacks/enterprise-stack.ts
related: ["[[enterprise-burn-fn]]", "[[rewards-distributor-fn]]", "[[enterprise-stack]]", "[[enterprise-data-credit-flow]]"]
updated: 2026-06-20
---

# BurnHistoryTable

Records $VIGIA token burn events. DynamoDB Stream NEW_IMAGE triggers [[rewards-distributor-fn]].

**CDK name:** `BurnHistoryTable`

## Schema

| Attribute | Type | Description |
|---|---|---|
| `burnId` | String (PK) | UUID |
| `timestamp` | String (SK) | ISO-8601 |
| `userId` | String | Enterprise user (Cognito sub) |
| `tokenAmount` | Number | micro-VGA burned |
| `dataCreditsGranted` | Number | Credits after burn conversion |
| `txHash` | String | Optional on-chain tx |

## Stream

NEW_IMAGE (batch 1, LATEST). Source event filter for [[rewards-distributor-fn]].

## Links

- [[enterprise-burn-fn]] — PutItem on new burn
- [[rewards-distributor-fn]] — triggered by stream
- [[enterprise-data-credit-flow]] — end-to-end flow
- [[enterprise-stack]] — CDK construct owning this table
