# VIGIA Solana — Implemented Tasks

## ✅ Anchor Program (`programs/vigia_protocol/`)

### Cargo.toml
- [x] `anchor-lang 0.30.1` with `init-if-needed` feature
- [x] `spl-account-compression 0.3.0` with `cpi` feature
- [x] `spl-noop 0.2.0`
- [x] Removed unused `anchor-spl`

### `src/constants.rs`
- [x] `VIGIA_AUTHORITY = "GYD8shoAEN7YabduYsM6SQgjWq5jp9assruMFV9FGJMc"` — hardcoded Lambda pubkey
- [x] `DISCOVERY_BOUNTY_LAMPORTS = 10_000_000` (0.01 SOL)
- [x] `VALIDATION_BOUNTY_LAMPORTS = 100_000` (0.0001 SOL)
- [x] `MIN_STAKE_LAMPORTS = 100_000_000` (0.1 SOL)
- [x] `HAZARD_REGISTRY_SIZE`, `NODE_STAKE_SIZE` byte constants

### `src/state.rs`
- [x] `HazardRegistry` — PDA `[b"hazard", h3_index_le, epoch_day_le]`, 67 bytes, no `merkle_tree` field
- [x] `NodeStake` — PDA `[b"stake", node_pubkey]`
- [x] `ValidationLeaf` — includes `h3_index` + `epoch_day` for off-chain filtering, appended to global tree
- [x] `status` module: `PENDING=0`, `VERIFIED=1`, `REJECTED=2`, `SLASHED=3`

### `src/error.rs`
- [x] `Unauthorized`, `InvalidEpoch`, `InsufficientStake`, `NodeBlacklisted`, `HazardNotVerified`, `InvalidMerkleTree`, `Overflow`

### `src/instructions/initialize_hazard.rs`
- [x] `init` constraint on PDA — protocol-level dedup (fails if PDA exists)
- [x] Clock drift guard: `require!(epoch_day == (Clock::get()?.unix_timestamp / 86400) as u32)`
- [x] `authority` must equal `VIGIA_AUTHORITY`
- [x] `node_stake` constraints: staked ≥ MIN_STAKE, not blacklisted
- [x] Vault PDA `[b"vault"]` funds Discovery Bounty via `system_program::transfer` CPI
- [x] Sets `HazardRegistry` fields, status = `VERIFIED`
- [x] Emits `HazardDiscovered` event

### `src/instructions/validate_hazard.rs`
- [x] Clock drift guard (same as initialize_hazard)
- [x] `hazard_registry.status == VERIFIED` constraint
- [x] `global_tree.key() == GLOBAL_VALIDATION_TREE` constraint
- [x] Increments `validation_count` with overflow check
- [x] Serializes `ValidationLeaf`, keccak-hashes, appends via `spl_account_compression::append` CPI
- [x] Vault pays Validation Bounty via `system_program::transfer` CPI
- [x] Emits `HazardValidated` event

### `src/instructions/slash_node.rs`
- [x] `close = burn_sink` on `node_stake` — staked SOL sent to `system_program::ID` (unrecoverable)
- [x] `authority` must equal `VIGIA_AUTHORITY`
- [x] Emits `NodeSlashed` event before account close

### `src/instructions/stake_node.rs`
- [x] `init` on `NodeStake` PDA
- [x] Validates `amount >= MIN_STAKE_LAMPORTS`
- [x] Transfers SOL from node to vault PDA

### `src/lib.rs`
- [x] `declare_id!("GYD8shoAEN7YabduYsM6SQgjWq5jp9assruMFV9FGJMc")`
- [x] Dispatches: `initialize_hazard`, `validate_hazard`, `slash_node`, `stake_node`

---

## ⏳ Pending

- [ ] `GLOBAL_VALIDATION_TREE` pubkey — replace placeholder after admin initializes the tree
- [ ] Admin `initialize_vault` instruction to fund the bounty vault
- [ ] AWS Lambda bridge (`packages/backend/src/solana/`)
- [ ] Frontend wallet adapter + `useSolanaHazardStream` hook
- [ ] Anchor tests
