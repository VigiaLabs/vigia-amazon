---
title: "Step Functions — Urban Planner"
type: aws-service
tags: [#aws-service, intelligence, urban-planning]
source: packages/infrastructure/lib/stacks/intelligence-stack.ts
related: ["[[urban-planner-fn]]", "[[bedrock-agent]]", "[[location-service]]", "[[intelligence-stack]]"]
updated: 2026-06-19
---

# Step Functions — Urban Planner State Machine

Express Workflow (synchronous, 30s timeout) orchestrating three micro-Lambdas for urban road planning.

## Workflow Steps

1. **GenerateBezierPath** (Python Lambda) — Computes smooth path geometry; checks geofence collection via `geo:BatchEvaluateGeofences`
2. **CalculateLandCost** (Python Lambda) — Estimates land acquisition cost for proposed road widening
3. **CheckZoneRegulations** (Python Lambda) — Validates path against zoning restrictions via geofence collection

The ASL definition lives at `packages/backend/src/workflows/urban-planner.asl.json`. Lambda ARNs are substituted at CDK synth time.

## Invocation

Bedrock service principal (`bedrock.amazonaws.com`) has `StartSyncExecution` permission, allowing the Bedrock Agent to call this State Machine directly as an action group tool. [[urban-planner-fn]] also invokes it when `USE_STEP_FUNCTIONS=true`.

## Links

- Invoked by → [[bedrock-agent]], [[urban-planner-fn]]
- Checks geofences → [[location-service]]
- Defined in → [[intelligence-stack]]
