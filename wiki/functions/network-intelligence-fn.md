---
title: "NetworkIntelligenceFn (Python)"
type: lambda
tags: [#lambda, intelligence]
source: packages/backend/src/actions/network-intelligence.py
related: ["[[bedrock-agent]]", "[[hazards-table]]", "[[intelligence-stack]]"]
updated: 2026-06-20
---

# NetworkIntelligenceFn (Python)

Python Lambda serving as the `networkIntelligence` action group for [[bedrock-agent]]. Analyzes DePIN network coverage and identifies gaps.

**Handler:** `network-intelligence.lambda_handler`
**Runtime:** Python 3.12, timeout 30s

## Links

- [[bedrock-agent]] — invokes this as action group Lambda
- [[hazards-table]] — coverage data source
- [[intelligence-stack]] — CDK construct owning this Lambda
