---
title: "SQS — Slash Node DLQ"
type: aws-service
tags: [#aws-service, reliability, security]
source: packages/infrastructure/lib/stacks/intelligence-stack.ts
related: ["[[slash-node-fn]]", "[[sybil-slashing]]", "[[intelligence-stack]]"]
updated: 2026-06-19
---

# SQS — Slash Node Dead-Letter Queue

Captures failed async [[slash-node-fn]] invocations after 2 retry attempts (14-day retention). A failed slash means a detected spoofer goes unpunished — capturing for redrive is critical.

**Retention:** 14 days
**Retry attempts:** 2

## Links
- Failure destination for → [[slash-node-fn]]
- Related to → [[sybil-slashing]]
- Defined in → [[intelligence-stack]]
