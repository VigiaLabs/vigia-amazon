---
title: "BedrockRouterFn (Python)"
type: lambda
tags: [#lambda, intelligence]
source: packages/backend/src/actions/bedrock-router.py
related: ["[[bedrock-agent]]", "[[hazards-table]]", "[[intelligence-stack]]"]
updated: 2026-06-20
---

# BedrockRouterFn (Python)

Python Lambda serving as the `hazardVerification` action group for [[bedrock-agent]]. Implements two tools used by the ReAct agent: `query_hazards` and `calculate_score`.

**Handler:** `bedrock-router.lambda_handler`
**Runtime:** Python 3.12, timeout 30s

## Action Group Tools

- **`query_hazards(geohash, radius)`** — Queries [[hazards-table]] for hazards near the given geohash. Returns count + recent hazards + computed `verificationScore`.
- **`calculate_score(confidence, similarReports)`** — Returns weighted composite verification score with breakdown.

## IAM

- HazardsTable: `grantReadData`
- `bedrock.amazonaws.com` has `lambda:InvokeFunction` permission (conditioned on sourceAccount)

## Links

- [[bedrock-agent]] — invokes this as action group Lambda
- [[hazards-table]] — DynamoDB query target
- [[intelligence-stack]] — CDK construct owning this Lambda
