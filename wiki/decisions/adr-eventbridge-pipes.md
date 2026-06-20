---
title: "ADR: EventBridge Pipes for INSERT-Only Filter"
type: decision
tags: [#decision, intelligence]
source: packages/infrastructure/lib/stacks/intelligence-stack.ts
related: ["[[eventbridge-pipes]]", "[[orchestrator-fn]]", "[[hazards-table]]"]
updated: 2026-06-20
---

# ADR: EventBridge Pipes for INSERT-Only Filter

## Context

HazardsTable DynamoDB Stream emits events for INSERT, MODIFY, and REMOVE operations. [[orchestrator-fn]] should only process new hazard submissions (INSERT), not status updates (MODIFY from PENDING→VERIFIED etc.).

## Decision

Use **EventBridge Pipes** with a DynamoDB stream source and `eventName = INSERT` filter expression, rather than checking `eventName` inside the Lambda.

## Rationale

- **Cost:** Pre-Lambda filtering means MODIFY events never invoke the Lambda (~60% reduction in Lambda invocations for an active hazard table).
- **Correctness:** EventBridge Pipes filter is evaluated before Lambda invocation — no race condition between filter and Lambda start.
- **Managed retry:** EventBridge Pipes has built-in retry with DLQ ([[sqs-orchestrator-dlq]]) — no custom retry logic in Lambda.
- **Pipe 2 (MODIFY+VERIFIED filter → SQS):** Second pipe fans out VERIFIED hazards to [[sqs-maintenance-queue]] for repair dispatch, also with pre-Lambda filtering.

## Consequences

- Two managed pipes rather than one Lambda with conditional logic.
- EventBridge Pipes batch size 10 for orchestrator (FIRE_AND_FORGET), batch size 1 for maintenance queue (guaranteed ordering).

## Links

- [[eventbridge-pipes]], [[orchestrator-fn]], [[sqs-orchestrator-dlq]], [[sqs-maintenance-queue]]
