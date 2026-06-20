---
title: "SQS — Orchestrator DLQ"
type: aws-service
tags: [#aws-service, reliability]
source: packages/infrastructure/lib/stacks/intelligence-stack.ts
related: ["[[orchestrator-fn]]", "[[intelligence-stack]]"]
updated: 2026-06-19
---

# SQS — Orchestrator Dead-Letter Queue

Captures failed async [[orchestrator-fn]] invocations after 2 retry attempts (14-day retention). The orchestrator is a FIRE_AND_FORGET EventBridge Pipe target; without this DLQ, failed events would be silently dropped.

**Retention:** 14 days
**Retry attempts:** 2

## Links
- Failure destination for → [[orchestrator-fn]]
- Defined in → [[intelligence-stack]]
