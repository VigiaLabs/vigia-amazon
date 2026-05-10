# Solana Lambda Migration — Task Tracker

**Program ID**: `BKaxbk73bCY8xRuphpkTESWjaJofdnBpuc2T193f3nkW`  
**Authority**: `7PTUbMJMWRwAixmkez2yBpsjovyAECtcXQHVYzAi8jf1`  
**Global Merkle Tree**: `HUWg7PsuqKtDxUe411mXNssfE2BSpq4ajao4GUab13LZ`  
**Vault PDA**: `3JiWf9TN3NaXHCmJdNuPVBbW6RxNFhfehXFgb3DuScYz` (funded: 2 SOL)

---

## ✅ Prerequisites (On-Chain)

- [x] Deploy Anchor program to Devnet
- [x] Generate authority keypair
- [x] Update `VIGIA_AUTHORITY` in `constants.rs` → redeploy
- [x] Initialize global Merkle tree (depth=14, buffer=64, 16K leaves)
- [x] Update `GLOBAL_VALIDATION_TREE` in `validate_hazard.rs` → redeploy
- [x] Fund vault PDA with 2 SOL

---

## ✅ Backend Lambda Migration

- [x] `packages/backend/package.json` — removed `ethers`/`@aws-sdk/client-kms`/`@rumblefishdev/eth-signer-kms`, added `@solana/web3.js` + `bs58` + `tweetnacl`
- [x] `packages/backend/src/solana/authority.ts` — Secrets Manager keypair bootstrap (module-level cache)
- [x] `packages/backend/src/solana/pda.ts` — `deriveHazardPDA`, `deriveNodeStakePDA`, `deriveVaultPDA`
- [x] `packages/backend/src/solana/instructions.ts` — discriminators (`global:initialize_hazard`, etc.), buffer builders, AccountMeta arrays
- [x] `packages/backend/src/solana/submit-hazard.ts` — VersionedTransaction dispatch, BigInt safety
- [x] `packages/backend/src/validator/index.ts` — `nacl.sign.detached.verify` replaces `ethers.verifyMessage`; payload requires `publicKey` field (base58)
- [x] `packages/backend/src/orchestrator/index.ts` — `submitHazardToChain()` call after VERIFIED verdict (non-blocking `.catch`)
- [x] `packages/backend/functions/slash-node/index.ts` — raw Solana `VersionedTransaction` replaces ethers+Polygon
- [x] `packages/backend/functions/rewards-balance/index.ts` — validates base58 pubkey, no ethers dependency
- [x] `packages/backend/functions/claim-signature/index.ts` — **DELETED** (bounties disbursed on-chain)

---

## ⏳ Remaining (Not Yet Implemented)

### Infrastructure
- [x] Store authority keypair in AWS Secrets Manager (`arn:aws:secretsmanager:us-east-1:123456789012:secret:vigia-solana-authority-REDACTED`)
- [x] Add env vars to Orchestrator Lambda: `SOLANA_RPC_URL`, `SOLANA_PROGRAM_ID`, `SOLANA_AUTHORITY_SECRET_ARN`, `GLOBAL_VALIDATION_TREE`
- [x] Add env vars to Slash-Node Lambda: `SOLANA_RPC_URL`, `SOLANA_PROGRAM_ID`, `SOLANA_AUTHORITY_SECRET_ARN`
- [x] Remove old env vars from Slash-Node: `KMS_KEY_ID`, `VIGIA_CONTRACT_ADDRESS`, `CHAIN_ID`, `POLYGON_AMOY_RPC_URL`, `RELAYER_PRIVATE_KEY`
- [x] Add `secretsmanager:GetSecretValue` IAM permission to Orchestrator + Slash-Node
- [x] Remove `kms:Sign`/`kms:GetPublicKey` IAM from Slash-Node
- [x] Update CDK stacks (`intelligence-stack.ts`)
- [ ] Run `cdk deploy` to apply changes

### Frontend
- [x] `useDeviceWallet.ts` — `nacl.sign.keyPair` + base58 secretKey in localStorage + `nacl.sign.detached` signing
- [x] `hazard-detector.worker.ts` — Ed25519 signing (payload string matches backend `VIGIA:type:lat:lon:ts:conf`)
- [x] `lib/constants.ts` — Solana RPC URL + program ID + `solanaExplorerTx()` / `solanaExplorerAddress()` helpers
- [x] `lib/contract.ts` — removed all EVM reads, added `readVaultBalance` + `readRecentTransactions` via Solana RPC
- [x] `RewardsWidget.tsx` — Solana Explorer links (`explorer.solana.com/tx/{sig}?cluster=devnet`)
- [x] `EnterpriseDashboard.tsx` — Solana Explorer links, removed PolygonScan
- [x] `LedgerTicker.tsx` — Solana Explorer links

### Testing
- [ ] Devnet E2E: stake → submit hazard → verify PDA created → bounty paid
- [ ] Verify clock drift guard rejects wrong epoch_day
- [ ] Verify duplicate PDA init fails (dedup)
- [ ] Verify slash closes account + burns SOL
- [ ] Frontend E2E: detect hazard → see bounty in wallet
