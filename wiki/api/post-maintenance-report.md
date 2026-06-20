---
title: "POST /maintenance/report"
type: api-route
tags: [#api-route, innovation]
source: packages/infrastructure/lib/stacks/innovation-stack.ts
related: ["[[api-gateway-innovation]]", "[[maintenance-report-handler-fn]]", "[[maintenance-queue-table]]"]
updated: 2026-06-20
---

# POST /maintenance/report

Creates a maintenance queue entry or updates an existing report status.

**Lambda:** [[maintenance-report-handler-fn]]

## New Report Body

```json
{
  "hazardId":"<uuid>", "geohash":"<p7>",
  "hazardType":"POTHOLE", "severity":0.8,
  "sessionId":"<uuid>"
}
```

## Status Update Body

```json
{ "reportId":"<uuid>", "status":"IN_PROGRESS" }
```

## Links

- [[maintenance-report-handler-fn]], [[maintenance-queue-table]]
