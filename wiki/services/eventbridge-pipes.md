---
title: "EventBridge Pipes"
type: aws-service
tags: [#aws-service, intelligence, event-driven]
source: packages/infrastructure/lib/stacks/intelligence-stack.ts
related: ["[[hazards-table]]", "[[orchestrator-fn]]", "[[sqs-maintenance-queue]]", "[[intelligence-stack]]", "[[adr-eventbridge-pipes]]"]
updated: 2026-06-19
---

# EventBridge Pipes

Two event-driven pipes fan out HazardsTable DynamoDB stream events without any polling Lambda.

## Pipe 1: HazardsToOrchestratorPipe

- **Source:** HazardsTable DynamoDB stream
- **Filter:** `{"eventName": ["INSERT"]}` — INSERT events only (skips ~60% of MODIFY/DELETE events)
- **Batch size:** 10 records
- **Target:** [[orchestrator-fn]] (FIRE_AND_FORGET / async)
- **Role:** Scoped IAM role with stream read + Lambda invoke only

This is the primary trigger for the hazard verification pipeline.

## Pipe 2: VerifiedHazardsToMaintenancePipe

- **Source:** HazardsTable DynamoDB stream
- **Filter:** `{"eventName": ["MODIFY"], "dynamodb": {"NewImage": {"status": {"S": ["VERIFIED"]}}}}` — MODIFY events where status transitions to VERIFIED
- **Batch size:** 1
- **Target:** [[sqs-maintenance-queue]]

Fans out verified hazards to the maintenance queue for cost estimation and repair scheduling.

## Links

- Source → [[hazards-table]]
- Target pipe 1 → [[orchestrator-fn]]
- Target pipe 2 → [[sqs-maintenance-queue]]
- Defined in → [[intelligence-stack]]
- Decision → [[adr-eventbridge-pipes]]
