---
title: "API Gateway — Session API"
type: aws-service
tags: [#aws-service, session, api]
source: packages/infrastructure/lib/stacks/session-stack.ts
related: ["[[session-crud-fn]]", "[[geohash-resolver-fn]]", "[[hash-chain-validator-fn]]", "[[places-search-fn]]", "[[session-stack]]", "[[session-files-table]]"]
updated: 2026-06-19
---

# API Gateway — VIGIA Session API

REST API for Map-as-a-File-System (MFS) session management, geohash resolution, and places search.

## Routes

| Method | Path | Lambda |
|--------|------|--------|
| POST/GET | /sessions | [[session-crud-fn]] |
| GET/PUT/DELETE | /sessions/{sessionId} | [[session-crud-fn]] |
| GET | /sessions/{sessionId}/validate | [[hash-chain-validator-fn]] |
| POST | /geohash/resolve | [[geohash-resolver-fn]] |
| POST | /places/search | [[places-search-fn]] |

## Links

- Routes to → [[session-crud-fn]], [[geohash-resolver-fn]], [[hash-chain-validator-fn]], [[places-search-fn]]
- Reads from → [[session-files-table]], [[ledger-entries-table]]
- Defined in → [[session-stack]]
