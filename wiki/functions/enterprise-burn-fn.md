---
title: "EnterpriseBurnFn"
type: lambda
tags: [#lambda, enterprise]
source: packages/backend/functions/enterprise/burn.ts
related: ["[[burn-history-table]]", "[[cognito-user-pool]]", "[[enterprise-api-routes]]", "[[enterprise-stack]]", "[[enterprise-data-credit-flow]]"]
updated: 2026-06-20
---

# EnterpriseBurnFn

Records $VIGIA token burn events. Protected by Cognito JWT. The BurnHistoryTable DynamoDB Stream triggers [[rewards-distributor-fn]].

**Handler:** `burn.handler`, **Runtime:** Node.js 20.x, timeout 15s

## Links

- [[burn-history-table]] — writes burn records (DynamoDB Stream source)
- [[cognito-user-pool]] — JWT authorizer
- [[rewards-distributor-fn]] — triggered by BurnHistoryTable stream
- [[enterprise-api-routes]] — POST /enterprise/burn
- [[enterprise-data-credit-flow]] — end-to-end flow
- [[enterprise-stack]] — CDK construct owning this Lambda
