---
title: "EnterpriseMeFn"
type: lambda
tags: [#lambda, enterprise]
source: packages/backend/functions/enterprise/me.ts
related: ["[[enterprise-users-table]]", "[[cognito-user-pool]]", "[[enterprise-api-routes]]", "[[enterprise-stack]]"]
updated: 2026-06-20
---

# EnterpriseMeFn

Returns enterprise user profile and API key. Protected by Cognito JWT.

**Handler:** `me.handler`, **Runtime:** Node.js 20.x, timeout 15s

## Links

- [[enterprise-users-table]] — user + API key lookup
- [[enterprise-api-routes]] — GET /enterprise/me
- [[enterprise-stack]] — CDK construct owning this Lambda
