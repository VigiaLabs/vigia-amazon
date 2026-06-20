---
title: "SQS — Verified Hazards Maintenance Queue"
type: aws-service
tags: [#aws-service, maintenance]
source: packages/infrastructure/lib/stacks/intelligence-stack.ts
related: ["[[eventbridge-pipes]]", "[[hazards-table]]", "[[maintenance-queue-table]]", "[[intelligence-stack]]"]
updated: 2026-06-19
---

# SQS — Verified Hazards Maintenance Queue

Fan-out queue receiving VERIFIED hazard events from EventBridge Pipe 2. Decouples hazard verification from maintenance scheduling.

**Visibility timeout:** 60 seconds
**Retention:** 1 day

Downstream consumer (not yet wired in CDK) would read from this queue to create maintenance reports in [[maintenance-queue-table]].

## Links
- Fed by → [[eventbridge-pipes]] (pipe 2)
- Source data → [[hazards-table]]
- Downstream → [[maintenance-queue-table]]
- Defined in → [[intelligence-stack]]
