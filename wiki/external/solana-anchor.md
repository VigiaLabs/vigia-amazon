---
title: "Solana Anchor Program"
type: external
tags: [#external, blockchain]
source: packages/backend/src/orchestrator/index.ts, packages/backend/functions/slash-node/index.ts, packages/backend/src/solana/authority.ts
related: ["[[orchestrator-fn]]", "[[slash-node-fn]]", "[[secrets-manager]]", "[[sybil-slashing]]", "[[solana-settlement-flow]]"]
updated: 2026-06-20
---

# Solana Anchor Program

Custom Anchor smart contract on Solana **devnet**.

**Program ID:** `BKaxbk73bCY8xRuphpkTESWjaJofdnBpuc2T193f3nkW`
**Network:** Devnet (`https://api.devnet.solana.com`)
**SDK:** `@solana/web3.js` v1.95.0

## Instructions

| Instruction | Caller | Description |
|---|---|---|
| `mint_to` / `submitHazardToChain` | [[orchestrator-fn]] | Records VERIFIED hazard on-chain with h3Index + epochDay + scores |
| `slash_node` | [[slash-node-fn]] | Burns node stake when VLM confidence < 0.1 |

## Authority Keypair

Loaded from [[secrets-manager]] secret `vigia-solana-authority-ro47l5` via lazy singleton (`src/solana/authority.ts`):
```ts
const { SecretString } = await sm.send(new GetSecretValueCommand({ SecretId: … }));
_authority = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(SecretString!).privateKey));
```

## Transaction Pattern

```ts
const tx = new VersionedTransaction(msg.compileToV0Message([]));
tx.sign([authority]);
const sig = await connection.sendTransaction(tx);
await connection.confirmTransaction(sig, 'confirmed');
```

## Links

- [[orchestrator-fn]] — submitHazardToChain (non-blocking)
- [[slash-node-fn]] — slash_node (blocking, 30s timeout)
- [[secrets-manager]] — authority keypair source
- [[sybil-slashing]] — slash security mechanism
- [[solana-settlement-flow]] — end-to-end flow
