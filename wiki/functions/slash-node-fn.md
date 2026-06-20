---
title: "SlashNodeFn"
type: lambda
tags: [#lambda, intelligence]
source: packages/backend/functions/slash-node/index.ts
related: ["[[orchestrator-fn]]", "[[vigia-device-registry]]", "[[solana-anchor]]", "[[sqs-slash-dlq]]", "[[sybil-slashing]]", "[[intelligence-stack]]"]
updated: 2026-06-20
---

# SlashNodeFn

On-chain penalty execution for nodes detected as spoofers by [[bedrock-nova-lite]]. Invoked async by [[orchestrator-fn]] when VLM confidence < 0.1.

**File:** `packages/backend/functions/slash-node/index.ts`
**Runtime:** Node.js 20.x, timeout 30s, memory 256 MB

## Handler Logic (slash-node/index.ts:12)

1. Loads Solana authority keypair via `getAuthority()` (from Secrets Manager).
2. Gets `connection` to Solana devnet via `getConnection()`.
3. Derives `nodeStakePDA` via `deriveNodeStakePDA(new PublicKey(walletAddress))`.
4. Builds `bytes32` `hazardIdBytes` = `createHash('sha256').update(hazardId).digest()`.
5. Calls `buildSlashNodeData(hazardIdBytes, reason)` + `buildSlashNodeIx(...)` from `src/solana/instructions.ts`.
6. Compiles VersionedTransaction, signs with authority, sends + confirms (`'confirmed'` commitment).
7. `UpdateCommand` on DeviceRegistryTable: `SET blacklisted=true, slashed_at, slash_reason, slash_tx`.

## IAM

- Secrets Manager: `GetSecretValue` on `vigia-solana-authority-ro47l5`
- DeviceRegistryTable: `dynamodb:UpdateItem` scoped to table ARN

Async invoke DLQ: [[sqs-slash-dlq]] (retryAttempts=2, 14-day retention).

## Links

- [[orchestrator-fn]] — async invoker (InvocationType='Event')
- [[solana-anchor]] — on-chain slash transaction
- [[vigia-device-registry]] — blacklist write
- [[sqs-slash-dlq]] — failure capture
- [[sybil-slashing]] — security mechanism this implements
- [[intelligence-stack]] — CDK construct owning this Lambda
