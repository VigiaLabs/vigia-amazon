# VIGIA — Solana Protocol Documentation

## Overview

The VIGIA Protocol is a Solana program that implements a Burn-and-Mint Equilibrium (BME) tokenomics model for decentralized road infrastructure monitoring. It handles hazard deduplication, bounty distribution, node staking, and fraud slashing — all settled on-chain in ~400ms.

**Program ID**: `BKaxbk73bCY8xRuphpkTESWjaJofdnBpuc2T193f3nkW`  
**Network**: Solana Devnet (mainnet migration planned Q3 2026)  
**Framework**: Anchor 0.30.1  
**Token**: $VIGIA SPL Token (`5UXva9WVVQ5oxHTjf5tqryi94crHWNFbW84qRV1fBLTa`, 6 decimals)

---

## Program Architecture

```
vigia_protocol/
├── programs/vigia_protocol/
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs              — Program entrypoint, instruction dispatch
│       ├── state.rs            — Account structs (HazardRegistry, NodeStake, ValidationLeaf)
│       ├── constants.rs        — Authority pubkey, bounty amounts, sizes
│       ├── error.rs            — Custom error codes
│       └── instructions/
│           ├── mod.rs
│           ├── initialize_hazard.rs   — Discovery bounty (mint 10 $VIGIA)
│           ├── validate_hazard.rs     — Validation bounty (mint 0.1 $VIGIA)
│           ├── slash_node.rs          — Fraud: close stake, burn SOL
│           ├── stake_node.rs          — Self-stake (node signs)
│           └── admin_stake_node.rs    — Sponsored stake (authority signs)
├── scripts/
│   └── init-merkle-tree.mjs   — Admin: initialize global Merkle tree
└── tasks.md                    — Implementation tracker
```

---

## On-Chain Accounts

### HazardRegistry PDA

The core deduplication primitive. One PDA per H3 cell per day.

| Field | Type | Size | Description |
|---|---|---|---|
| `h3_index` | u64 | 8 | H3 resolution-9 cell index (~12m hexagons) |
| `epoch_day` | u32 | 4 | `floor(unix_timestamp / 86400)` — resets daily |
| `discoverer` | Pubkey | 32 | First reporter's Ed25519 pubkey |
| `discovery_ts` | i64 | 8 | Unix timestamp of first report |
| `validation_count` | u32 | 4 | Number of subsequent confirmations today |
| `vlm_confidence` | u8 | 1 | VLM confidence 0-100 |
| `status` | u8 | 1 | 0=PENDING, 1=VERIFIED, 2=REJECTED, 3=SLASHED |
| `bump` | u8 | 1 | PDA bump seed |

**Seeds**: `["hazard", h3_index.to_le_bytes(), epoch_day.to_le_bytes()]`  
**Size**: 8 (discriminator) + 59 = 67 bytes  
**Rent**: ~0.001 SOL

**Deduplication logic**: Anchor's `init` constraint fails if the PDA already exists. This makes double-discovery impossible at the protocol level — no application-layer dedup needed.

**Daily reset**: Same pothole gets a new PDA each day (epoch_day changes). This allows re-discovery rewards as road conditions evolve.

### NodeStake PDA

Proof-of-stake for edge nodes. Required to earn bounties.

| Field | Type | Size | Description |
|---|---|---|---|
| `node` | Pubkey | 32 | Staking node's Ed25519 pubkey |
| `staked_lamports` | u64 | 8 | SOL staked (minimum 0.1 SOL) |
| `stake_ts` | i64 | 8 | When the stake was created |
| `blacklisted` | bool | 1 | Set by `slash_node` — permanently blocks rewards |
| `bump` | u8 | 1 | PDA bump seed |

**Seeds**: `["stake", node_pubkey]`  
**Size**: 8 + 50 = 58 bytes

### ValidationLeaf (Compressed — NOT an account)

Appended to the global Merkle tree. Never stored as a Solana account.

| Field | Type | Size | Description |
|---|---|---|---|
| `h3_index` | u64 | 8 | Which cell this validation is for |
| `epoch_day` | u32 | 4 | Which day |
| `validator` | [u8; 32] | 32 | Validator's Ed25519 pubkey |
| `timestamp` | i64 | 8 | Unix timestamp |
| `onnx_conf` | u8 | 1 | Edge ONNX confidence 0-100 |
| `signature_hash` | [u8; 32] | 32 | SHA-256 of the edge payload signature |

**Total**: 85 bytes → keccak-hashed → 32-byte leaf appended to Merkle tree  
**Cost**: ~$0.000005 per validation (vs $0.003 for a standard account)

---

## Instructions

### `initialize_hazard`

**Trigger**: First verified hazard at an H3 cell today.  
**Effect**: Creates HazardRegistry PDA + mints 10 $VIGIA to discoverer.

**Arguments**:
- `h3_index: u64` — H3 resolution-9 cell index
- `epoch_day: u32` — current day (verified against on-chain clock)
- `vlm_confidence: u8` — VLM confidence 0-100
- `onnx_confidence: u8` — edge ONNX confidence 0-100

**Accounts** (in order):
1. `hazard_registry` — PDA (init, writable)
2. `node_stake` — discoverer's stake PDA (read-only, constraints enforced)
3. `discoverer` — Ed25519 pubkey (read-only)
4. `discoverer_ata` — $VIGIA Associated Token Account (writable)
5. `vigia_mint` — SPL Token mint (writable)
6. `mint_authority` — PDA signer for mint_to (read-only)
7. `authority` — Lambda keypair (signer, payer)
8. `token_program` — SPL Token program
9. `system_program` — System program

**Security guards**:
- Clock drift: `require!(epoch_day == (Clock::get()?.unix_timestamp / 86400) as u32)`
- Staking: `node_stake.staked_lamports >= 100_000_000` (0.1 SOL)
- Blacklist: `!node_stake.blacklisted`
- Authority: `authority.key() == VIGIA_AUTHORITY`

### `validate_hazard`

**Trigger**: Subsequent verified hazard at same H3 cell today.  
**Effect**: Increments validation_count + appends Merkle leaf + mints 0.1 $VIGIA.

**Arguments**:
- `h3_index: u64`
- `epoch_day: u32`
- `onnx_confidence: u8`
- `signature_hash: [u8; 32]` — SHA-256 of the edge payload signature

**Accounts** (in order):
1. `hazard_registry` — existing PDA (writable)
2. `node_stake` — validator's stake PDA (read-only)
3. `validator` — Ed25519 pubkey (read-only)
4. `validator_ata` — $VIGIA ATA (writable)
5. `vigia_mint` — SPL Token mint (writable)
6. `mint_authority` — PDA signer (read-only)
7. `global_tree` — concurrent Merkle tree (writable)
8. `authority` — Lambda keypair (signer)
9. `compression_program` — SPL Account Compression
10. `noop_program` — SPL Noop (for Merkle tree logging)
11. `token_program` — SPL Token program
12. `system_program` — System program

**Additional guard**: `hazard_registry.status == VERIFIED`

### `slash_node`

**Trigger**: VLM confidence < 0.1 (fraud detection).  
**Effect**: Closes NodeStake PDA, burns staked SOL, blacklists node permanently.

**Arguments**:
- `hazard_id: [u8; 32]` — SHA-256 of the hazardId string
- `reason: String` — human-readable reason

**Mechanism**: `close = burn_sink` where `burn_sink = system_program::ID` — SOL is sent to the system program address (unrecoverable).

### `stake_node`

**Trigger**: Edge node self-stakes (node is the signer).  
**Effect**: Creates NodeStake PDA, transfers SOL to vault.

### `admin_stake_node`

**Trigger**: Authority stakes on behalf of a node (sponsored onboarding).  
**Effect**: Same as `stake_node` but authority pays and signs.

**Why this exists**: Browser-generated Ed25519 keypairs have zero SOL balance. They can't sign transactions or pay rent. The authority (AWS Lambda) sponsors their stake from its own balance, enabling zero-friction onboarding.

---

## Key Addresses

| Component | Address | Purpose |
|---|---|---|
| Program | `BKaxbk73bCY8xRuphpkTESWjaJofdnBpuc2T193f3nkW` | Deployed program |
| Authority | `7PTUbMJMWRwAixmkez2yBpsjovyAECtcXQHVYzAi8jf1` | Lambda signer (Secrets Manager) |
| $VIGIA Mint | `5UXva9WVVQ5oxHTjf5tqryi94crHWNFbW84qRV1fBLTa` | SPL Token (6 decimals) |
| Mint Authority PDA | `93VTjeXiqa9iZYtwNpuhsu7THNGgYptUpuFcRMYay3Ja` | Signs mint_to (program-controlled) |
| Global Merkle Tree | `HUWg7PsuqKtDxUe411mXNssfE2BSpq4ajao4GUab13LZ` | Validation event compression |
| Vault PDA | `3JiWf9TN3NaXHCmJdNuPVBbW6RxNFhfehXFgb3DuScYz` | Holds staked SOL |

---

## State Compression Strategy

### Why Compression

Every `validate_hazard` call appends a leaf to a concurrent Merkle tree instead of creating a standard account.

| Storage method | Cost per validation | At 30K/day | At 1M/day |
|---|---|---|---|
| Standard account | ~$0.003 | $90/day | $3,000/day |
| Compressed leaf | ~$0.000005 | $0.15/day | $5/day |

**Savings: 99.99%**

### Global Tree Configuration

| Parameter | Value | Rationale |
|---|---|---|
| Max depth | 14 | 2^14 = 16,384 leaves (sufficient for devnet) |
| Max buffer size | 64 | Concurrent writes supported |
| Canopy depth | 0 | Not needed (Lambda is sole writer) |
| Initialization cost | 0.22 SOL | One-time admin transaction |

### How Appending Works

```
1. Serialize ValidationLeaf (85 bytes)
2. Keccak-hash → 32-byte leaf_hash
3. Build raw Instruction (discriminator + leaf_hash)
4. invoke() to SPL Account Compression program
5. Tree root updated atomically
```

The `h3_index` and `epoch_day` are encoded in the leaf data so off-chain indexers can filter by location and date without reading the full tree.

---

## Tokenomics ($VIGIA)

### Mint Mechanics

| Event | Tokens | Frequency | Who Receives |
|---|---|---|---|
| Discovery (new cell today) | 10 $VIGIA | ~10/node/day | Discoverer |
| Validation (confirm existing) | 0.1 $VIGIA | ~100/cell/day | Validator |

**Supply**: Uncapped. Grows proportionally to network activity.  
**Decimals**: 6 (1 $VIGIA = 1,000,000 raw units)

### Burn Mechanics (Enterprise)

Enterprises burn $VIGIA to receive Data Credits:
- 1 $VIGIA burned = 1,000 API credits
- Data Credits are non-transferable, pegged to API calls
- Burns reduce total supply (deflationary)

### Equilibrium

```
Mint rate = f(active_nodes × hazards_per_day)
Burn rate = f(enterprise_api_consumption)
Price stability when: mint_rate ≈ burn_rate
```

---

## Security Model

### Authority-Only Execution

All hazard-related instructions require `authority.key() == VIGIA_AUTHORITY`. No user can call `initialize_hazard` or `validate_hazard` directly. The AWS Lambda is the sole gateway — it only submits transactions after VLM + Agent verification passes.

### Clock Drift Prevention

Both `initialize_hazard` and `validate_hazard` independently verify:
```rust
let current_epoch_day = (Clock::get()?.unix_timestamp / 86400) as u32;
require!(epoch_day == current_epoch_day, VigiaError::InvalidEpoch);
```

A compromised Lambda cannot pass a future/past date to mint extra Discovery Bounties.

### Staking Requirement

Nodes must have `staked_lamports >= 100_000_000` (0.1 SOL) to earn bounties. This creates economic skin-in-the-game — submitting fraudulent data risks losing the stake.

### Slashing

When VLM confidence < 0.1 (strong fraud signal):
1. `slash_node` closes the NodeStake PDA
2. Staked SOL sent to `system_program::ID` (burned, unrecoverable)
3. `blacklisted = true` — node can never earn again
4. `NodeSlashed` event emitted for indexers

### PDA Deduplication

The `init` constraint on `initialize_hazard` makes double-discovery physically impossible. If the PDA exists, the transaction fails. No application-layer dedup needed — the protocol enforces it.

---

## AWS Lambda Bridge

### How the Lambda Calls Solana

```typescript
// 1. Derive PDAs (deterministic, zero RPC)
const [hazardPDA] = PublicKey.findProgramAddressSync([...], PROGRAM_ID);

// 2. Check PDA existence (1 RPC call)
const existing = await connection.getAccountInfo(hazardPDA);

// 3. Build instructions array
instructions = [
  createAssociatedTokenAccountIdempotent(...),  // Always (no-op if exists)
  adminStakeNode(...),                          // Only if unstaked
  initializeHazard(...) OR validateHazard(...)  // The actual hazard
];

// 4. VersionedTransaction (modern, no polling loop)
const tx = new VersionedTransaction(message.compileToV0Message());
tx.sign([authority]);
await connection.sendTransaction(tx);
await connection.confirmTransaction({signature, blockhash, lastValidBlockHeight});
```

### Raw Bytecode (No Anchor IDL)

The Lambda builds instructions as raw buffers:
```
[8-byte discriminator][packed arguments]
```

Discriminator = `SHA256("global:<instruction_name>")[0..8]`

No `@coral-xyz/anchor` client. No IDL. Pure `@solana/web3.js` + manual buffer packing.

---

## Future Innovations

### Phase 1: Mainnet Migration (Q3 2026)
- Deploy to Solana mainnet-beta
- Dedicated RPC (Helius/QuickNode) for production throughput
- Increase Merkle tree depth to 30 (1 billion leaves)
- Add canopy for third-party proof verification

### Phase 2: Governance (Q4 2026)
- On-chain voting for bounty amounts (DAO)
- Community-elected slashing committee
- Stake-weighted voting power

### Phase 3: Cross-Chain Settlement (2027)
- Wormhole bridge for $VIGIA on Ethereum/Polygon
- Enterprise burns on any chain, settled on Solana
- Multi-chain Data Credit issuance

### Phase 4: Advanced Compression (2027)
- Regional Merkle trees (one per country) for data sovereignty
- ZK-proofs for privacy-preserving validation (prove hazard exists without revealing exact location)
- Compressed NFTs for hazard discovery certificates

### Phase 5: Autonomous Maintenance (2028)
- On-chain maintenance dispatch (program triggers repair orders)
- Repair verification via before/after image comparison
- Contractor payment escrow in $VIGIA
- Insurance claim automation via verified road condition data

---

## Development

### Build
```bash
cd vigia_protocol
anchor build  # or: cargo-build-sbf
```

### Deploy
```bash
solana program deploy target/deploy/vigia_protocol.so --program-id BKaxbk73bCY8xRuphpkTESWjaJofdnBpuc2T193f3nkW
```

### Initialize Merkle Tree (Admin, one-time)
```bash
node scripts/init-merkle-tree.mjs
```

### Test (E2E)
```bash
node scripts/test-solana-e2e.mjs
```
