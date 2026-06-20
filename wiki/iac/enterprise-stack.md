---
title: "EnterpriseStack"
type: iac
tags: [#iac]
source: packages/infrastructure/lib/stacks/enterprise-stack.ts
related: ["[[api-gateway-enterprise]]", "[[cognito-user-pool]]", "[[enterprise-register-fn]]", "[[enterprise-login-fn]]", "[[enterprise-burn-fn]]", "[[enterprise-me-fn]]", "[[rewards-distributor-fn]]", "[[enterprise-users-table]]", "[[burn-history-table]]", "[[vigia-stack]]"]
updated: 2026-06-20
---

# EnterpriseStack

AWS CDK Construct for enterprise authentication, token burn, and reward distribution.

**File:** `packages/infrastructure/lib/stacks/enterprise-stack.ts`

## Resources Owned

**Cognito:** [[cognito-user-pool]] + UserPoolClient (`vigia-enterprise-client`, `USER_PASSWORD_AUTH` + `ALLOW_REFRESH_TOKEN_AUTH`)

**Tables:** [[enterprise-users-table]], [[burn-history-table]]

**Lambdas:** [[enterprise-register-fn]], [[enterprise-login-fn]], [[enterprise-burn-fn]], [[enterprise-me-fn]], [[rewards-distributor-fn]]

**API:** [[api-gateway-enterprise]] (REST API, `prod` stage, `CognitoUserPoolsAuthorizer`)

## Links

- [[vigia-stack]] — instantiates this
