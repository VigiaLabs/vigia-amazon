---
title: "POST /routing-agent/branch"
type: api-route
tags: [#api-route, innovation]
source: packages/infrastructure/lib/stacks/innovation-stack.ts
related: ["[[api-gateway-innovation]]", "[[routing-agent-branch-fn]]"]
updated: 2026-06-20
---

# POST /routing-agent/branch

Computes route impact for a set of hazards.

**Lambda:** [[routing-agent-branch-fn]]

## Request Body

```json
{ "branchId":"<uuid>", "hazards":[{"geohash":"…","type":"POTHOLE"},…] }
```

## Response

```json
{
  "baselineAvgLatency":120, "branchAvgLatency":144,
  "delta":24, "deltaPercent":20,
  "affectedRoutes":9
}
```

## Links

- [[routing-agent-branch-fn]]
