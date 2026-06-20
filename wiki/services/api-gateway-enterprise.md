---
title: "API Gateway — Enterprise API"
type: aws-service
tags: [#aws-service, enterprise, api]
source: packages/infrastructure/lib/stacks/enterprise-stack.ts
related: ["[[enterprise-register-fn]]", "[[enterprise-login-fn]]", "[[enterprise-burn-fn]]", "[[enterprise-stack]]", "[[cognito-user-pool]]", "[[enterprise-users-table]]"]
updated: 2026-06-19
---

# API Gateway — vigia-enterprise API

REST API for enterprise user management, JWT authentication (Cognito), and $VIGIA token burn.

## Routes

| Method | Path | Auth | Lambda |
|--------|------|------|--------|
| POST | /enterprise/register | None | [[enterprise-register-fn]] |
| POST | /enterprise/login | None | [[enterprise-login-fn]] |
| GET | /enterprise/me | Cognito JWT | enterprise-me handler |
| POST | /enterprise/burn | Cognito JWT | [[enterprise-burn-fn]] |

Protected routes use `CognitoUserPoolsAuthorizer` backed by [[cognito-user-pool]].

## Links

- Auth → [[cognito-user-pool]]
- Routes to → [[enterprise-register-fn]], [[enterprise-login-fn]], [[enterprise-burn-fn]]
- Data in → [[enterprise-users-table]], [[burn-history-table]]
- Defined in → [[enterprise-stack]]
