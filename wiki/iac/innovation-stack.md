---
title: "InnovationStack"
type: iac
tags: [#iac]
source: packages/infrastructure/lib/stacks/innovation-stack.ts
related: ["[[api-gateway-innovation]]", "[[agent-trace-streamer-fn]]", "[[routing-agent-branch-fn]]", "[[maintenance-report-handler-fn]]", "[[maintenance-queue-query-fn]]", "[[economic-metrics-query-fn]]", "[[maintenance-queue-table]]", "[[economic-metrics-table]]", "[[agent-traces-table]]", "[[agent-rate-limit-table]]", "[[vigia-stack]]"]
updated: 2026-06-20
---

# InnovationStack

AWS CDK Construct for maintenance, routing agent, economic metrics, and trace streaming.

**File:** `packages/infrastructure/lib/stacks/innovation-stack.ts`

## Resources Owned

**Tables:** [[maintenance-queue-table]], [[economic-metrics-table]], [[agent-traces-table]], [[agent-rate-limit-table]]

**Lambdas:** [[agent-trace-streamer-fn]], [[routing-agent-branch-fn]], [[maintenance-report-handler-fn]], [[maintenance-queue-query-fn]], [[economic-metrics-query-fn]]

**API:** [[api-gateway-innovation]] (REST API, `prod` stage)

## Links

- [[vigia-stack]] — instantiates this
