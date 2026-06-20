---
title: "Amazon Cognito — Enterprise User Pool"
type: aws-service
tags: [#aws-service, enterprise, auth]
source: packages/infrastructure/lib/stacks/enterprise-stack.ts
related: ["[[enterprise-register-fn]]", "[[enterprise-login-fn]]", "[[api-gateway-enterprise]]", "[[enterprise-stack]]"]
updated: 2026-06-19
---

# Amazon Cognito — Enterprise User Pool

JWT-based authentication for enterprise users (municipalities, insurers). Self-signup enabled, email alias, 8-char password minimum.

**Auth flows:** USER_PASSWORD_AUTH, USER_SRP_AUTH
**No client secret** (public client for web apps)

Protected routes on [[api-gateway-enterprise]] use `CognitoUserPoolsAuthorizer`. Lambdas call `cognito-idp:AdminCreateUser`, `AdminSetUserPassword`, `AdminInitiateAuth`, `InitiateAuth`.

## Links
- Used by → [[api-gateway-enterprise]]
- Registered via → [[enterprise-register-fn]]
- Authenticated via → [[enterprise-login-fn]]
- Defined in → [[enterprise-stack]]
