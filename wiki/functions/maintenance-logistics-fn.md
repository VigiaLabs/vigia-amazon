---
title: "MaintenanceLogisticsFn (Python)"
type: lambda
tags: [#lambda, intelligence]
source: packages/backend/src/actions/maintenance-logistics.py
related: ["[[bedrock-agent]]", "[[hazards-table]]", "[[maintenance-queue-table]]", "[[intelligence-stack]]"]
updated: 2026-06-20
---

# MaintenanceLogisticsFn (Python)

Python Lambda serving as the `maintenanceLogistics` action group for [[bedrock-agent]]. Prioritizes repair tasks and estimates costs.

**Handler:** `maintenance-logistics.lambda_handler`
**Runtime:** Python 3.12, timeout 30s

## Links

- [[bedrock-agent]] — invokes this as action group Lambda
- [[hazards-table]], [[maintenance-queue-table]] — data sources
- [[intelligence-stack]] — CDK construct owning this Lambda
