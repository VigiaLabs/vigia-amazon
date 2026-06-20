---
title: "Session API Routes"
type: api-route
tags: [#api-route, session]
source: packages/infrastructure/lib/stacks/session-stack.ts
related: ["[[api-gateway-session]]", "[[session-crud-fn]]", "[[geohash-resolver-fn]]", "[[hash-chain-validator-fn]]", "[[places-search-fn]]"]
updated: 2026-06-20
---

# Session API Routes

All on [[api-gateway-session]], `prod` stage.

| Method | Path | Lambda |
|---|---|---|
| POST | /sessions | [[session-crud-fn]] — create |
| GET | /sessions/{sessionId} | [[session-crud-fn]] — read |
| PUT | /sessions/{sessionId} | [[session-crud-fn]] — update |
| DELETE | /sessions/{sessionId} | [[session-crud-fn]] — delete |
| GET | /sessions/{sessionId}/validate | [[hash-chain-validator-fn]] |
| POST | /geohash/resolve | [[geohash-resolver-fn]] |
| POST | /places/search | [[places-search-fn]] |

## Links

- [[api-gateway-session]]
- All session Lambda functions above
