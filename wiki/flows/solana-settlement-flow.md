---
title: "Solana Settlement Flow"
type: flow
tags: [#flow, intelligence]
source: packages/backend/src/orchestrator/index.ts, packages/backend/src/solana/authority.ts
related: ["[[orchestrator-fn]]", "[[solana-anchor]]", "[[secrets-manager]]"]
updated: 2026-06-20
---

# Solana Settlement Flow

Non-blocking on-chain settlement of VERIFIED hazards via Solana Anchor program.

## Steps

```
OrchestratorFn: verdict = VERIFIED (after tryCreditReward)
  │
  └─ submitHazardToChain (non-blocking, try/catch swallowed)
       getAuthority()     ← lazy-load keypair from Secrets Manager
       getConnection()    ← devnet https://api.devnet.solana.com
       Build instruction: submitHazardToChain {
         h3Index, epochDay, discovererPubkey,
         vlmConfidence, onnxConfidence, signatureHash
       }
       VersionedTransaction.sign([authority])
       connection.sendTransaction(tx)
       connection.confirmTransaction(sig, 'confirmed')
```

On-chain failure is logged but does NOT block the orchestrator response. The off-chain credit in [[rewards-ledger-table]] is the authoritative reward record.

## Links

- [[orchestrator-fn]] — non-blocking call site
- [[solana-anchor]] — Anchor program on devnet
- [[secrets-manager]] — authority keypair source
