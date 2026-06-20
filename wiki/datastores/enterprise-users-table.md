---
title: "EnterpriseUsersTable"
type: datastore
tags: [#datastore, enterprise]
source: packages/infrastructure/lib/stacks/enterprise-stack.ts
related: ["[[enterprise-register-fn]]", "[[enterprise-login-fn]]", "[[enterprise-me-fn]]", "[[cognito-user-pool]]", "[[enterprise-stack]]"]
updated: 2026-06-20
---

# EnterpriseUsersTable

Enterprise user records and generated API keys.

**CDK name:** `EnterpriseUsersTable`

## Schema

| Attribute | Type | Description |
|---|---|---|
| `userId` | String (PK) | Cognito sub (UUID) |
| `email` | String | |
| `organizationName` | String | |
| `apiKey` | String | Generated UUID API key |
| `createdAt` | String | ISO-8601 |
| `plan` | String | TRIAL / STANDARD / ENTERPRISE |

## GSI

| Index | PK |
|---|---|
| `apiKey-index` | `apiKey` |

## Links

- [[enterprise-register-fn]], [[enterprise-me-fn]] — read/write user records
- [[cognito-user-pool]] — JWT auth for all enterprise routes
- [[enterprise-stack]] — CDK construct owning this table
