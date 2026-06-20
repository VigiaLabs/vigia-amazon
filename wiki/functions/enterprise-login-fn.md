---
title: "EnterpriseLoginFn"
type: lambda
tags: [#lambda, enterprise]
source: packages/backend/functions/enterprise/login.ts
related: ["[[cognito-user-pool]]", "[[enterprise-api-routes]]", "[[enterprise-stack]]"]
updated: 2026-06-20
---

# EnterpriseLoginFn

Authenticates enterprise users via Cognito `InitiateAuth`.

**Handler:** `login.handler`, **Runtime:** Node.js 20.x, timeout 15s

## IAM

`cognito-idp:InitiateAuth` on UserPool ARN.

## Links

- [[cognito-user-pool]] — authentication
- [[enterprise-api-routes]] — POST /enterprise/login
- [[enterprise-stack]] — CDK construct owning this Lambda
