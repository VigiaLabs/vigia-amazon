---
title: "IntelligenceStack"
type: iac
tags: [#iac]
source: packages/infrastructure/lib/stacks/intelligence-stack.ts
related: ["[[orchestrator-fn]]", "[[slash-node-fn]]", "[[verify-hazard-sync-fn]]", "[[rewards-balance-fn]]", "[[bedrock-router-fn]]", "[[network-intelligence-fn]]", "[[maintenance-logistics-fn]]", "[[urban-planner-fn]]", "[[bedrock-agent]]", "[[bedrock-nova-lite]]", "[[eventbridge-pipes]]", "[[step-functions-urban-planner]]", "[[cooldown-table]]", "[[traces-table]]", "[[rewards-ledger-table]]", "[[sqs-orchestrator-dlq]]", "[[sqs-slash-dlq]]", "[[location-service]]", "[[vigia-stack]]"]
updated: 2026-06-20
---

# IntelligenceStack

AWS CDK Construct hosting verification, orchestration, and AI resources.

**File:** `packages/infrastructure/lib/stacks/intelligence-stack.ts`

## Resources Owned

**Tables:** [[cooldown-table]], [[traces-table]], [[rewards-ledger-table]]

**SQS:** [[sqs-orchestrator-dlq]], [[sqs-slash-dlq]], [[sqs-maintenance-queue]] (fan-out)

**EventBridge Pipes:** [[eventbridge-pipes]] (2 pipes: INSERT filter → Orchestrator; MODIFY+VERIFIED → maintenance SQS)

**Step Functions:** [[step-functions-urban-planner]] (Express, 30s timeout)

**Location:** [[location-service]] (CfnGeofenceCollection, CfnRouteCalculator Esri)

**Bedrock:** [[bedrock-agent]] construct (BedrockAgentConfig), [[bedrock-nova-lite]] model access

**Lambdas:** [[orchestrator-fn]], [[slash-node-fn]], [[verify-hazard-sync-fn]], [[rewards-balance-fn]], [[diff-analysis-fn]], [[agent-chat-fn]], [[bedrock-router-fn]], [[network-intelligence-fn]], [[maintenance-logistics-fn]], [[urban-planner-fn]]

## Cross-Stack Inputs

From [[ingestion-stack]]: HazardsTable ARN (stream), HazardFramesBucket ARN, DeviceRegistryTable ARN, PiDeviceRegistryTable ARN

## Links

- See resource links above; [[vigia-stack]] instantiates this
