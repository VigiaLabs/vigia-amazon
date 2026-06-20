---
title: "UrbanPlannerFn (Python)"
type: lambda
tags: [#lambda, intelligence]
source: packages/backend/src/actions/urban-planner.py
related: ["[[bedrock-agent]]", "[[step-functions-urban-planner]]", "[[location-service]]", "[[hazards-table]]", "[[economic-metrics-table]]", "[[intelligence-stack]]"]
updated: 2026-06-20
---

# UrbanPlannerFn (Python)

Python Lambda serving as the `urbanPlanner` action group for [[bedrock-agent]]. Computes optimal routes and road path proposals. When `USE_STEP_FUNCTIONS=true`, proxies to [[step-functions-urban-planner]] (Express synchronous execution).

**Handler:** `urban-planner.lambda_handler`
**Runtime:** Python 3.12, timeout 30s

## Env Vars

- `STATE_MACHINE_ARN` — injected by CDK; used when `USE_STEP_FUNCTIONS=true`
- `ROUTE_CALCULATOR_NAME` — `{stackName}-RouteCalc`

## IAM

- `geo:CalculateRoute` on Route Calculator ARN
- `states:StartSyncExecution` on Urban Planner State Machine

## Links

- [[bedrock-agent]] — invokes this as action group Lambda
- [[step-functions-urban-planner]] — orchestrated sub-workflow
- [[location-service]] — Route Calculator + geofence API
- [[intelligence-stack]] — CDK construct owning this Lambda
