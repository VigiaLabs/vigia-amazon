---
title: "GeohashResolverFn"
type: lambda
tags: [#lambda, session]
source: packages/backend/src/geohash/resolver.ts
related: ["[[location-service]]", "[[session-api-routes]]", "[[session-stack]]"]
updated: 2026-06-20
---

# GeohashResolverFn

Decodes a geohash to human-readable city/region via Amazon Location Service ReverseGeocode.

**File:** `packages/backend/src/geohash/resolver.ts`
**Runtime:** Node.js 20.x, timeout 10s

## IAM

`geo-places:ReverseGeocode` on `resources: ['*']`

## Links

- [[location-service]] — ReverseGeocode API
- [[session-api-routes]] — POST /geohash/resolve
- [[session-stack]] — CDK construct owning this Lambda
