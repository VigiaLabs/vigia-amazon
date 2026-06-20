---
title: "Enterprise API Routes"
type: api-route
tags: [#api-route, enterprise]
source: packages/infrastructure/lib/stacks/enterprise-stack.ts
related: ["[[api-gateway-enterprise]]", "[[cognito-user-pool]]", "[[enterprise-register-fn]]", "[[enterprise-login-fn]]", "[[enterprise-burn-fn]]", "[[enterprise-me-fn]]"]
updated: 2026-06-20
---

# Enterprise API Routes

All on [[api-gateway-enterprise]], `prod` stage. Non-login routes protected by `CognitoUserPoolsAuthorizer`.

| Method | Path | Lambda | Auth |
|---|---|---|---|
| POST | /enterprise/register | [[enterprise-register-fn]] | None |
| POST | /enterprise/login | [[enterprise-login-fn]] | None |
| POST | /enterprise/burn | [[enterprise-burn-fn]] | Cognito JWT |
| GET | /enterprise/me | [[enterprise-me-fn]] | Cognito JWT |

## Links

- [[api-gateway-enterprise]], [[cognito-user-pool]]
- All enterprise Lambda functions above
