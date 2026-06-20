---
title: "EnterpriseRegisterFn"
type: lambda
tags: [#lambda, enterprise]
source: packages/backend/functions/enterprise/register.ts
related: ["[[cognito-user-pool]]", "[[enterprise-users-table]]", "[[enterprise-api-routes]]", "[[enterprise-stack]]"]
updated: 2026-06-20
---

# EnterpriseRegisterFn

Creates a new enterprise user in Cognito and EnterpriseUsersTable.

**Handler:** `register.handler`, **Runtime:** Node.js 20.x, timeout 15s

## IAM

`cognito-idp:AdminCreateUser`, `cognito-idp:AdminSetUserPassword`, `cognito-idp:AdminInitiateAuth` on UserPool ARN.

## Links

- [[cognito-user-pool]] — user creation
- [[enterprise-users-table]] — user record store
- [[enterprise-api-routes]] — POST /enterprise/register
- [[enterprise-stack]] — CDK construct owning this Lambda
