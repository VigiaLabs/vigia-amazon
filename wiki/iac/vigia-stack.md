---
title: "VigiaStack (Root)"
type: iac
tags: [#iac]
source: packages/infrastructure/lib/vigia-stack.ts
related: ["[[ingestion-stack]]", "[[intelligence-stack]]", "[[trust-stack]]", "[[innovation-stack]]", "[[enterprise-stack]]", "[[session-stack]]", "[[visualization-stack]]"]
updated: 2026-06-20
---

# VigiaStack (Root)

Root CDK Stack. Instantiates all six sub-stacks and wires cross-stack references.

**File:** `packages/infrastructure/lib/vigia-stack.ts`

## Cross-Stack Wiring

After instantiation, VigiaStack injects IntelligenceStack table ARNs into IngestionStack Lambda env vars:
```ts
ingestionStack.stripePayoutFn.addEnvironment(
  'REWARDS_LEDGER_TABLE_NAME', intelligenceStack.rewardsLedgerTable.tableName);
ingestionStack.stripePayoutFn.addEnvironment(
  'REWARDS_LEDGER_TABLE_ARN', intelligenceStack.rewardsLedgerTable.tableArn);
```

Also adds [[verify-hazard-sync-fn]] and [[rewards-balance-fn]] routes to [[api-gateway-telemetry]] via cross-stack method call:
```ts
ingestionStack.addVerifyHazardRoute(intelligenceStack.verifyHazardSyncFn);
ingestionStack.addRewardsBalanceRoute(intelligenceStack.rewardsBalanceFn);
```

## Sub-Stack Instantiation Order

1. [[trust-stack]] (no deps)
2. [[ingestion-stack]] (no deps)
3. [[intelligence-stack]] (depends on ingestion: HazardsTable, FramesBucket, DeviceRegistry)
4. [[innovation-stack]] (depends on intelligence: AgentTracesTable)
5. [[enterprise-stack]] (depends on intelligence: RewardsLedgerTable)
6. [[session-stack]] (independent)
7. [[visualization-stack]] (placeholder)

## Links

- [[ingestion-stack]], [[intelligence-stack]], [[trust-stack]], [[innovation-stack]], [[enterprise-stack]], [[session-stack]] — instantiated here
