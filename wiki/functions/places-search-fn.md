---
title: "PlacesSearchFn"
type: lambda
tags: [#lambda, session]
source: packages/backend/src/places/search.ts
related: ["[[location-service]]", "[[session-api-routes]]", "[[session-stack]]"]
updated: 2026-06-20
---

# PlacesSearchFn

Amazon Location Service text search and reverse geocoding.

**File:** `packages/backend/src/places/search.ts`
**Runtime:** Node.js 20.x, timeout 10s

## IAM

`geo-places:SearchText`, `geo-places:ReverseGeocode` on `resources: ['*']`

## Links

- [[location-service]] — SearchText + ReverseGeocode APIs
- [[session-api-routes]] — POST /places/search
- [[session-stack]] — CDK construct owning this Lambda
