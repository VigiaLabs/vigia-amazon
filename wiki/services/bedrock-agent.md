---
title: "Amazon Bedrock Agent (TAWWC3SQ0L)"
type: aws-service
tags: [#aws-service, intelligence, ai]
source: packages/infrastructure/lib/stacks/intelligence-stack.ts, packages/infrastructure/lib/constructs/bedrock-agent.ts
related: ["[[orchestrator-fn]]", "[[verify-hazard-sync-fn]]", "[[agent-chat-fn]]", "[[bedrock-router-fn]]", "[[network-intelligence-fn]]", "[[maintenance-logistics-fn]]", "[[urban-planner-fn]]", "[[bedrock-nova-lite]]", "[[diff-analysis-fn]]", "[[intelligence-stack]]"]
updated: 2026-06-19
---

# Amazon Bedrock Agent — TAWWC3SQ0L

ReAct agent running on Amazon Nova Lite foundation model, with 4 action groups covering the full VIGIA decision surface.

**Agent ID:** `TAWWC3SQ0L`
**Alias ID:** `TSTALIASID`
**Foundation model:** [[bedrock-nova-lite]] (`amazon.nova-lite-v1:0`)

## Action Groups

| Action Group | Lambda | Purpose |
|---|---|---|
| HazardVerification | [[bedrock-router-fn]] | `query_hazards`, `calculate_score` — core verification tools |
| NetworkIntelligence | [[network-intelligence-fn]] | Coverage analysis, node distribution |
| MaintenanceLogistics | [[maintenance-logistics-fn]] | Repair queue prioritization |
| UrbanPlanner | [[urban-planner-fn]] | Route planning + Step Functions proxy |

## Invocation Paths

1. **[[orchestrator-fn]]** — Invokes agent on 2% VLM sample path with VLM reasoning as input text
2. **[[verify-hazard-sync-fn]]** — Synchronous path for interactive demo (API Gateway → Bedrock Agent)
3. **[[agent-chat-fn]]** — Free-form chat via `InvokeAgentCommand` with `enableTrace: true`
4. **[[diff-analysis-fn]]** — Road infrastructure diff analysis via agent

## Tracing

All agent invocations have `enableTrace: true`. Orchestration traces (rationale, tool use, tool observations, final response) are parsed and stored in [[traces-table]].

## Links

- Uses model → [[bedrock-nova-lite]]
- Action group Lambdas → [[bedrock-router-fn]], [[network-intelligence-fn]], [[maintenance-logistics-fn]], [[urban-planner-fn]]
- Called by → [[orchestrator-fn]], [[verify-hazard-sync-fn]], [[agent-chat-fn]], [[diff-analysis-fn]]
- Traces stored in → [[traces-table]]
- Defined in → [[intelligence-stack]]
