---
title: "RoutingAgentBranchFn"
type: lambda
tags: [#lambda, innovation]
source: packages/backend/functions/routing-agent-branch/index.ts
related: ["[[post-routing-agent-branch]]", "[[innovation-stack]]"]
updated: 2026-06-20
---

# RoutingAgentBranchFn

Route impact computation per hazard set. Computes baseline vs hazard-adjusted latency + affected route count. Uses in-memory SHA-256 keyed cache.

**File:** `packages/backend/functions/routing-agent-branch/index.ts`
**Runtime:** Node.js 20.x, timeout 30s, memory 512 MB

## Handler Logic

1. Parses `{ branchId, hazards }`.
2. Cache key = `SHA-256(JSON.stringify(hazards))`. If cached → return cached result.
3. Computes: `branchAvgLatency = baselineAvgLatency * (1 + hazardCount * 0.05)`, `affectedRoutes = min(hazardCount * 3, 50)`.
4. Returns `{ baselineAvgLatency, branchAvgLatency, delta, deltaPercent, affectedRoutes, computedAt }`.

(Real Bedrock Agent invocation is stubbed as TODO comment.)

## Links

- [[post-routing-agent-branch]] — API route
- [[innovation-stack]] — CDK construct owning this Lambda
