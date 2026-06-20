---
title: "SessionCRUDFn"
type: lambda
tags: [#lambda, session]
source: packages/backend/src/sessions/handler.ts
related: ["[[session-files-table]]", "[[ledger-entries-table]]", "[[session-api-routes]]", "[[session-stack]]"]
updated: 2026-06-20
---

# SessionCRUDFn

Map-as-a-File-System (MFS) session management: create, read, update, delete.

**File:** `packages/backend/src/sessions/handler.ts`
**Runtime:** Node.js 20.x, timeout 30s

## Links

- [[session-files-table]] — primary read/write
- [[ledger-entries-table]] — writes ledger entries on session changes
- [[session-api-routes]] — CRUD routes (/sessions, /sessions/{sessionId})
- [[session-stack]] — CDK construct owning this Lambda
