# VIGIA — Solana Architecture Design Spec

**Status**: Draft — Awaiting Implementation  
**Supersedes**: Polygon Amoy / EVM architecture  
**Date**: 2026-05-08

---

## Context: Why This Architecture Is Different

The EVM migration analysis made a critical error: it mapped DynamoDB wallet-keyed records directly to on-chain PDAs. This is wrong for VIGIA.

VIGIA's deduplication unit is **not the wallet** — it is the **H3 hex cell + epoch date**. The on-chain state machine must answer one question per hazard report: *"Has this physical location been discovered today?"* If no → Discovery Bounty. If yes → Validation Bounty. The PDA seed encodes this question directly.

Additionally, storing every validation event as a standard Solana account at ~0.002 SOL rent each would cost ~$60/day at 30,000 hazards/day. State compression via concurrent Merkle trees reduces this to ~$0.000005 per event — the actual technical moat.

---

## A. State Architecture — The H3 PDA Model

### Seed Design

```
PDA seed = ["hazard", h3_hex_id_bytes, epoch_day_u32_le]
```

- `h3_hex_id_bytes`: 8-byte little-endian encoding of the H3 resolution-9 index (~12m cells)
- `epoch_day_u32_le`: `floor(unix_timestamp / 86400)` as u32 little-endian — resets daily so the same pothole can be re-discovered the next day (road conditions change)

This means:
- First report at H3 cell `8928308280fffff` on day `20574` → PDA does not exist → `initialize_hazard` → Discovery Bounty
- Second report at same cell same day → PDA exists → `validate_hazard` → Validation Bounty
- Same cell next day → PDA does not exist → Discovery Bounty again

### `HazardRegistry` Account

```rust
#[account]
pub struct HazardRegistry {
    pub h3_index:          u64,      // H3 resolution-9 cell index
    pub epoch_day:         u32,      // floor(unix_ts / 86400) — verified against Clock on-chain
    pub discoverer:        Pubkey,   // first reporter's Ed25519 pubkey
    pub discovery_ts:      i64,      // unix timestamp of first report
    pub validation_count:  u32,      // number of subsequent validations
    pub vlm_confidence:    u8,       // 0-100, set by AWS Lambda after Bedrock VLM
    pub status:            u8,       // 0=PENDING, 1=VERIFIED, 2=REJECTED, 3=SLASHED
    pub bump:              u8,
}
// Size: 8 (discriminator) + 8 + 4 + 32 + 8 + 4 + 1 + 1 + 1 = 67 bytes
// Rent-exempt: ~0.00107 SOL
// merkle_tree field removed — global tree used (see Section D)
```

### `ValidationEvent` — Compressed (NOT a standard account)

Each validation is appended to the concurrent Merkle tree as a leaf, not stored as an account:

```rust
#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ValidationLeaf {
    pub validator:      [u8; 32],  // Ed25519 pubkey
    pub timestamp:      i64,
    pub onnx_conf:      u8,        // 0-100
    pub signature_hash: [u8; 32],  // SHA-256 of the edge payload signature
}
// 73 bytes per leaf — appended to Merkle tree, zero rent
```

### `NodeStake` Account

```rust
#[account]
pub struct NodeStake {
    pub node:           Pubkey,
    pub staked_lamports: u64,      // SOL staked (not VGA — simpler for devnet)
    pub stake_ts:       i64,
    pub blacklisted:    bool,
    pub bump:           u8,
}
// Seed: ["stake", node_pubkey]
```

---

## B. Core Anchor Instructions

### `initialize_hazard`

Triggered by the AWS Lambda Orchestrator after Bedrock VLM confirms the hazard is real and the H3 PDA does not yet exist for today.

```rust
pub fn initialize_hazard(
    ctx: Context<InitializeHazard>,
    h3_index: u64,
    epoch_day: u32,
    vlm_confidence: u8,
    onnx_confidence: u8,
) -> Result<()>
```

**Account constraints:**
```rust
#[derive(Accounts)]
#[instruction(h3_index: u64, epoch_day: u32)]
pub struct InitializeHazard<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 99,
        seeds = [b"hazard", &h3_index.to_le_bytes(), &epoch_day.to_le_bytes()],
        bump
    )]
    pub hazard_registry: Account<'info, HazardRegistry>,

    #[account(
        seeds = [b"stake", discoverer.key().as_ref()],
        bump,
        constraint = node_stake.staked_lamports >= MIN_STAKE @ VigiaError::InsufficientStake,
        constraint = !node_stake.blacklisted @ VigiaError::NodeBlacklisted,
    )]
    pub node_stake: Account<'info, NodeStake>,

    /// CHECK: Ed25519 pubkey of the edge node that reported the hazard
    pub discoverer: UncheckedAccount<'info>,

    /// The concurrent Merkle tree for validation events (pre-initialized)
    pub merkle_tree: UncheckedAccount<'info>,

    #[account(mut, constraint = authority.key() == VIGIA_AUTHORITY @ VigiaError::Unauthorized)]
    pub authority: Signer<'info>,  // AWS Lambda keypair (from Secrets Manager)

    pub system_program: Program<'info, System>,
}
```

**Logic:**
1. **Verify epoch_day against on-chain clock** — prevents Lambda compromise from minting infinite Discovery Bounties with future/past dates:
   ```rust
   let current_epoch_day = (Clock::get()?.unix_timestamp / 86400) as u32;
   require!(epoch_day == current_epoch_day, VigiaError::InvalidEpoch);
   ```
2. Set all `HazardRegistry` fields
3. Emit `HazardDiscovered` event with `h3_index`, `discoverer`, `vlm_confidence`
4. Transfer Discovery Bounty SOL from program vault to `discoverer` (e.g. 0.01 SOL)

**Discovery Bounty amount:** `DISCOVERY_BOUNTY_LAMPORTS = 10_000_000` (0.01 SOL)

> **Security note**: The `epoch_day` argument is still required in the instruction (for PDA seed derivation in the `#[instruction]` macro), but the program independently re-derives the current epoch from `Clock::get()` and rejects any mismatch. A compromised Lambda cannot pass a different date.

---

### `validate_hazard`

Triggered by the Lambda for subsequent reports at the same H3 cell on the same day. Appends a compressed leaf to the Merkle tree.

```rust
pub fn validate_hazard(
    ctx: Context<ValidateHazard>,
    h3_index: u64,
    epoch_day: u32,
    onnx_confidence: u8,
    signature_hash: [u8; 32],
) -> Result<()>
```

**Account constraints:**
```rust
#[derive(Accounts)]
#[instruction(h3_index: u64, epoch_day: u32)]
pub struct ValidateHazard<'info> {
    #[account(
        mut,
        seeds = [b"hazard", &h3_index.to_le_bytes(), &epoch_day.to_le_bytes()],
        bump = hazard_registry.bump,
        constraint = hazard_registry.status == 1 @ VigiaError::HazardNotVerified,
    )]
    pub hazard_registry: Account<'info, HazardRegistry>,

    #[account(
        seeds = [b"stake", validator.key().as_ref()],
        bump,
        constraint = node_stake.staked_lamports >= MIN_STAKE @ VigiaError::InsufficientStake,
        constraint = !node_stake.blacklisted @ VigiaError::NodeBlacklisted,
    )]
    pub node_stake: Account<'info, NodeStake>,

    /// CHECK: validator edge node pubkey
    pub validator: UncheckedAccount<'info>,

    /// The concurrent Merkle tree — must match hazard_registry.merkle_tree
    #[account(mut, constraint = merkle_tree.key() == hazard_registry.merkle_tree)]
    pub merkle_tree: UncheckedAccount<'info>,

    pub compression_program: Program<'info, SplAccountCompression>,
    pub noop_program: Program<'info, Noop>,

    #[account(mut, constraint = authority.key() == VIGIA_AUTHORITY @ VigiaError::Unauthorized)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}
```

**Logic:**
1. **Verify epoch_day against on-chain clock** (same guard as `initialize_hazard`):
   ```rust
   let current_epoch_day = (Clock::get()?.unix_timestamp / 86400) as u32;
   require!(epoch_day == current_epoch_day, VigiaError::InvalidEpoch);
   ```
2. Increment `hazard_registry.validation_count`
3. Build `ValidationLeaf` and call `spl_account_compression::append` to add it to the global Merkle tree
4. Transfer Validation Bounty to `validator` (e.g. 0.0001 SOL — 100x smaller than Discovery)
5. Emit `HazardValidated` event

**Validation Bounty amount:** `VALIDATION_BOUNTY_LAMPORTS = 100_000` (0.0001 SOL)

---

### `slash_node`

Triggered by the Lambda when Bedrock VLM confidence < 0.1 (fraud detection). Closes the node's stake account and burns the SOL.

```rust
pub fn slash_node(
    ctx: Context<SlashNode>,
    hazard_id: [u8; 32],
    reason: String,
) -> Result<()>
```

**Account constraints:**
```rust
#[derive(Accounts)]
pub struct SlashNode<'info> {
    #[account(
        mut,
        seeds = [b"stake", node.key().as_ref()],
        bump = node_stake.bump,
        close = burn_account,  // closes PDA, sends rent to burn address
    )]
    pub node_stake: Account<'info, NodeStake>,

    /// CHECK: the node being slashed
    pub node: UncheckedAccount<'info>,

    /// CHECK: 11111111111111111111111111111111 (system program = burn)
    #[account(address = system_program::ID)]
    pub burn_account: UncheckedAccount<'info>,

    #[account(mut, constraint = authority.key() == VIGIA_AUTHORITY @ VigiaError::Unauthorized)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}
```

**Logic:**
1. Set `node_stake.blacklisted = true` before close (written to event log)
2. `close = burn_account` sends staked SOL to system program (effectively burned)
3. Emit `NodeSlashed` event with `node`, `hazard_id`, `reason`

---

## C. AWS-to-Solana Bridge

### Lambda Keypair Bootstrap (Cold Start)

The AWS Lambda acts as the sole authorized signer (`VIGIA_AUTHORITY`). Its Ed25519 keypair is stored in AWS Secrets Manager as a base58-encoded private key.

```typescript
// packages/backend/src/solana/authority.ts
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

let _authority: Keypair | null = null;

export async function getAuthority(): Promise<Keypair> {
  if (_authority) return _authority;  // cached after cold start
  const sm = new SecretsManagerClient({ region: 'us-east-1' });
  const { SecretString } = await sm.send(new GetSecretValueCommand({
    SecretId: process.env.SOLANA_AUTHORITY_SECRET_ARN!,
  }));
  const { privateKey } = JSON.parse(SecretString!);
  _authority = Keypair.fromSecretKey(bs58.decode(privateKey));
  return _authority;
}
```

**Secret format in Secrets Manager:**
```json
{ "privateKey": "base58EncodedSecretKey...", "publicKey": "base58EncodedPublicKey..." }
```

The `publicKey` is hardcoded as `VIGIA_AUTHORITY` in the Anchor program's `declare_id!` and constraint checks.

### Transaction Construction (Orchestrator Lambda)

After Bedrock VLM scores the hazard, the Orchestrator Lambda:

```typescript
// packages/backend/src/solana/submit-hazard.ts
import { Connection, Transaction, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { getAuthority } from './authority';
import { latLonToH3, h3ToIndex } from './h3-utils';

const connection = new Connection(process.env.SOLANA_RPC_URL!, 'confirmed');

export async function submitHazardToChain(params: {
  lat: number; lon: number;
  discovererPubkey: string;
  vlmConfidence: number;
  onnxConfidence: number;
  isFirstReport: boolean;
  signatureHash: string;
}) {
  const authority = await getAuthority();
  const provider = new AnchorProvider(connection, new Wallet(authority), { commitment: 'confirmed' });
  const program = new Program(IDL, PROGRAM_ID, provider);

  const h3Index = latLonToH3(params.lat, params.lon, 9);  // resolution 9 = ~12m
  const epochDay = Math.floor(Date.now() / 1000 / 86400);
  const [hazardPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('hazard'), h3IndexToBuffer(h3Index), epochDayToBuffer(epochDay)],
    program.programId
  );

  // Check if PDA exists to determine Discovery vs Validation
  const existing = await connection.getAccountInfo(hazardPDA);

  if (!existing) {
    // initialize_hazard → Discovery Bounty
    const tx = await program.methods
      .initializeHazard(
        new BN(h3Index.toString()),
        epochDay,
        Math.round(params.vlmConfidence * 100),
        Math.round(params.onnxConfidence * 100),
      )
      .accounts({
        hazardRegistry: hazardPDA,
        discoverer: new PublicKey(params.discovererPubkey),
        merkleTree: await getOrCreateMerkleTree(h3Index),
        authority: authority.publicKey,
      })
      .rpc();
    return { type: 'DISCOVERY', signature: tx, bounty: 0.01 };
  } else {
    // validate_hazard → Validation Bounty
    const sigHash = Buffer.from(params.signatureHash, 'hex');
    const tx = await program.methods
      .validateHazard(
        new BN(h3Index.toString()),
        epochDay,
        Math.round(params.onnxConfidence * 100),
        [...sigHash],
      )
      .accounts({
        hazardRegistry: hazardPDA,
        validator: new PublicKey(params.discovererPubkey),
        merkleTree: (await program.account.hazardRegistry.fetch(hazardPDA)).merkleTree,
        authority: authority.publicKey,
      })
      .rpc();
    return { type: 'VALIDATION', signature: tx, bounty: 0.0001 };
  }
}
```

### RPC Configuration

```
SOLANA_RPC_URL = https://api.devnet.solana.com          (devnet)
SOLANA_RPC_URL = https://api.mainnet-beta.solana.com    (mainnet)
```

Use a dedicated RPC provider (Helius, QuickNode) in production — public RPC rate limits will throttle at 30,000 hazards/day.

---

## D. Account Compression Strategy

### Why Compression Is Non-Negotiable

| Storage method | Cost per validation | At 30K/day |
|---|---|---|
| Standard Solana account | ~0.002 SOL (~$0.003) | ~$90/day |
| Compressed leaf (Merkle tree) | ~0.000005 SOL (~$0.000007) | ~$0.21/day |

**Savings: 99.99%**

### Global Tree Architecture (NOT per-cell trees)

The original spec proposed one Merkle tree per H3 cell. This is wrong for two reasons:
1. **CU overflow** — `init_empty_merkle_tree` is computationally expensive (~200K CUs). Running it inside `initialize_hazard` in the same transaction would exceed the 1.4M CU limit.
2. **Cost** — H3 resolution-9 has ~570 billion cells globally. Even at city scale, initializing thousands of trees would cost hundreds of SOL.

**The correct design: one pre-initialized global Merkle tree** (or one per geographic region, e.g. one per country). The tree is initialized once by an admin transaction before the program goes live. All `validate_hazard` calls append to this shared tree.

```
GLOBAL_VALIDATION_TREE_PUBKEY = <pre-initialized by admin, stored in program config>
```

The `HazardRegistry.merkle_tree` field is **removed** from the struct. All validation events go to the global tree. The `h3_index` and `epoch_day` are encoded in the leaf data to maintain per-cell queryability off-chain.

### Updated `HazardRegistry` Account (no merkle_tree field)

```rust
#[account]
pub struct HazardRegistry {
    pub h3_index:          u64,
    pub epoch_day:         u32,
    pub discoverer:        Pubkey,
    pub discovery_ts:      i64,
    pub validation_count:  u32,
    pub vlm_confidence:    u8,
    pub status:            u8,
    // merkle_tree field REMOVED — global tree used instead
    pub bump:              u8,
}
// Size: 8 + 8 + 4 + 32 + 8 + 4 + 1 + 1 + 1 = 67 bytes
```

### Updated `ValidationLeaf` (includes cell context)

```rust
#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ValidationLeaf {
    pub h3_index:       u64,       // which cell this validation is for
    pub epoch_day:      u32,       // which day
    pub validator:      [u8; 32],  // Ed25519 pubkey
    pub timestamp:      i64,
    pub onnx_conf:      u8,
    pub signature_hash: [u8; 32],
}
// 81 bytes per leaf
```

### Global Tree Sizing

```typescript
// Pre-initialized once by admin. Sized for 1 year of global traffic.
const MAX_DEPTH = 30;          // 2^30 = ~1 billion leaves
const MAX_BUFFER_SIZE = 2048;  // high concurrency for global writes
const CANOPY_DEPTH = 14;       // enables efficient proof verification

// One-time initialization cost: ~50 SOL
// Amortized over 1 billion validations: ~0.00000005 SOL each
```

### Appending in `validate_hazard`

The `validate_hazard` accounts struct passes `GLOBAL_VALIDATION_TREE_PUBKEY` directly — no per-cell tree lookup needed:

```rust
#[account(
    mut,
    constraint = global_tree.key() == GLOBAL_VALIDATION_TREE_PUBKEY @ VigiaError::InvalidMerkleTree
)]
pub global_tree: UncheckedAccount<'info>,
```

```rust
let leaf = ValidationLeaf {
    h3_index: ctx.accounts.hazard_registry.h3_index,
    epoch_day: ctx.accounts.hazard_registry.epoch_day,
    validator: ctx.accounts.validator.key().to_bytes(),
    timestamp: Clock::get()?.unix_timestamp,
    onnx_conf: onnx_confidence,
    signature_hash,
};
let leaf_hash = keccak::hashv(&[&leaf.try_to_vec()?]).0;

spl_account_compression::append(
    CpiContext::new(
        ctx.accounts.compression_program.to_account_info(),
        spl_account_compression::cpi::accounts::Modify {
            merkle_tree: ctx.accounts.global_tree.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
            noop: ctx.accounts.noop_program.to_account_info(),
        },
    ),
    leaf_hash,
)?;
```

Note: the authority for the global tree is `VIGIA_AUTHORITY` (the Lambda keypair), not the `HazardRegistry` PDA. This simplifies the CPI signer — no PDA signer seeds needed.

---

## E. Frontend Changes

### E1. Wallet Adapter (replaces `window.ethereum`)

```tsx
// packages/frontend/app/providers/SolanaProvider.tsx
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, BackpackWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import '@solana/wallet-adapter-react-ui/styles.css';

const wallets = [new PhantomWalletAdapter(), new BackpackWalletAdapter(), new SolflareWalletAdapter()];

export function SolanaProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConnectionProvider endpoint={process.env.NEXT_PUBLIC_SOLANA_RPC_URL!}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
```

Wrap `app/layout.tsx` with `<SolanaProvider>`. Replace `useDeviceWallet` hook's `ethers.Wallet` with `@solana/web3.js` `Keypair` for the autonomous edge node identity (separate from the user's Phantom wallet used for claiming).

### E2. Bounty Tiering Visualizer (`RewardsWidget.tsx`)

The rewards store must track bounty type per event:

```typescript
interface BountyEvent {
  type: 'DISCOVERY' | 'VALIDATION';
  amount: number;   // SOL
  timestamp: number;
  txSignature: string;
  h3Index: string;
}
```

UI changes:
- Discovery events: large green spike `+0.01 SOL 🔍 NEW HAZARD` with H3 cell ID
- Validation events: small teal tick `+0.0001 SOL ✓ CONFIRMED`
- Running total in SOL (not VGA wei — no 18-decimal conversion needed)
- Replace `amoy.polygonscan.com/tx/` with `https://explorer.solana.com/tx/{sig}?cluster=devnet`

### E3. Sub-Second Observability (WebSocket + fallback polling)

Replace polling with a WebSocket subscription. The hook must handle RPC disconnects gracefully — Solana WebSocket connections drop frequently in production (idle timeouts, RPC node restarts).

```typescript
// packages/frontend/app/hooks/useSolanaHazardStream.ts
import { useEffect, useRef, useCallback } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';

const FALLBACK_POLL_MS = 10_000;   // poll every 10s when WS is down
const RECONNECT_BASE_MS = 1_000;   // initial reconnect delay
const RECONNECT_MAX_MS = 30_000;   // cap at 30s

export function useSolanaHazardStream(onHazard: (event: any) => void) {
  const subIdRef       = useRef<number | null>(null);
  const connRef        = useRef<Connection | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimer      = useRef<ReturnType<typeof setInterval> | null>(null);
  const attemptRef     = useRef(0);
  const wsAlive        = useRef(false);

  const stopFallback = () => {
    if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
  };

  const startFallback = useCallback((fetchFn: () => Promise<void>) => {
    if (pollTimer.current) return;
    pollTimer.current = setInterval(fetchFn, FALLBACK_POLL_MS);
  }, []);

  const subscribe = useCallback(() => {
    const conn = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL!, {
      commitment: 'confirmed',
      wsEndpoint: process.env.NEXT_PUBLIC_SOLANA_WS_URL,
    });
    connRef.current = conn;

    const fallbackFetch = async () => {
      // Lightweight REST fallback: fetch last 5 program transactions
      try {
        const sigs = await conn.getSignaturesForAddress(
          new PublicKey(process.env.NEXT_PUBLIC_SOLANA_PROGRAM_ID!),
          { limit: 5 }
        );
        sigs.forEach(s => onHazard({ signature: s.signature, source: 'fallback' }));
      } catch (_) {}
    };

    subIdRef.current = conn.onLogs(
      new PublicKey(process.env.NEXT_PUBLIC_SOLANA_PROGRAM_ID!),
      (logs) => {
        wsAlive.current = true;
        stopFallback();           // WS is alive — stop polling
        attemptRef.current = 0;
        const event = parseAnchorEvent(logs.logs, logs.signature);
        if (event) onHazard(event);
      },
      'confirmed'
    );

    // If no WS event arrives within 5s, assume connection is dead and start fallback
    const healthCheck = setTimeout(() => {
      if (!wsAlive.current) startFallback(fallbackFetch);
    }, 5000);

    return () => clearTimeout(healthCheck);
  }, [onHazard, startFallback]);

  const reconnect = useCallback(() => {
    // Exponential backoff capped at 30s
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** attemptRef.current, RECONNECT_MAX_MS);
    attemptRef.current++;
    reconnectTimer.current = setTimeout(() => {
      wsAlive.current = false;
      subscribe();
    }, delay);
  }, [subscribe]);

  useEffect(() => {
    subscribe();
    // Solana's Connection doesn't expose an onClose callback directly.
    // Poll the subscription health every 15s and reconnect if stale.
    const healthInterval = setInterval(() => {
      if (!wsAlive.current && !pollTimer.current) reconnect();
      wsAlive.current = false; // reset — will be set true if WS fires
    }, 15_000);

    return () => {
      clearInterval(healthInterval);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      stopFallback();
      if (connRef.current && subIdRef.current !== null) {
        connRef.current.removeOnLogsListener(subIdRef.current);
      }
    };
  }, [subscribe, reconnect]);
}

/** Parse Anchor event discriminator from program log lines */
function parseAnchorEvent(logs: string[], signature: string) {
  for (const log of logs) {
    if (log.includes('HazardDiscovered'))  return { type: 'DISCOVERY',  signature, raw: log };
    if (log.includes('HazardValidated'))   return { type: 'VALIDATION', signature, raw: log };
    if (log.includes('NodeSlashed'))       return { type: 'SLASH',      signature, raw: log };
  }
  return null;
}
```

**Behaviour summary:**
- WS connected and firing → fallback polling is off, zero extra requests
- WS silent for 5s → fallback polling starts at 10s intervals
- WS reconnects → fallback polling stops immediately
- Reconnect attempts use exponential backoff: 1s → 2s → 4s → … → 30s cap

### E4. Explorer Links

```typescript
// packages/frontend/app/lib/constants.ts — add:
export const SOLANA_CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'devnet';
export const solanaExplorerTx = (sig: string) =>
  `https://explorer.solana.com/tx/${sig}?cluster=${SOLANA_CLUSTER}`;
export const solanaExplorerAddress = (addr: string) =>
  `https://explorer.solana.com/address/${addr}?cluster=${SOLANA_CLUSTER}`;
```

Replace all `amoy.polygonscan.com` references with `solanaExplorerTx(sig)`.

---

## F. Files to Change (Implementation Checklist)

### New files
| File | Purpose |
|---|---|
| `packages/contracts-solana/programs/vigia/src/lib.rs` | Anchor program |
| `packages/contracts-solana/programs/vigia/src/state.rs` | HazardRegistry, NodeStake structs |
| `packages/contracts-solana/programs/vigia/src/instructions/` | initialize_hazard, validate_hazard, slash_node |
| `packages/backend/src/solana/authority.ts` | Secrets Manager keypair bootstrap |
| `packages/backend/src/solana/submit-hazard.ts` | Transaction construction |
| `packages/backend/src/solana/h3-utils.ts` | H3 index ↔ Buffer conversion |
| `packages/frontend/app/providers/SolanaProvider.tsx` | Wallet adapter setup |
| `packages/frontend/app/hooks/useSolanaHazardStream.ts` | WebSocket event subscription |

### Modified files
| File | Change |
|---|---|
| `packages/frontend/app/lib/constants.ts` | Swap Polygon → Solana constants |
| `packages/frontend/app/lib/contract.ts` | Rewrite with `@solana/web3.js` |
| `packages/frontend/app/hooks/useDeviceWallet.ts` | `ethers.Wallet` → `Keypair` + `nacl` |
| `packages/frontend/app/workers/hazard-detector.worker.ts` | ECDSA P-256 → Ed25519 (`tweetnacl`) |
| `packages/frontend/app/components/RewardsWidget.tsx` | Bounty tiering UI + Solana Explorer links |
| `packages/frontend/app/components/EnterpriseDashboard.tsx` | Phantom wallet, SOL amounts, Solscan links |
| `packages/frontend/app/components/LedgerTicker.tsx` | Solana Explorer links |
| `packages/frontend/app/components/HazardVerificationPanel.tsx` | Replace polling with WebSocket subscription |
| `packages/frontend/app/components/NetworkMapView.tsx` | Replace polling with WebSocket subscription |
| `packages/backend/src/validator/index.ts` | `ethers.verifyMessage` → Ed25519 verify |
| `packages/backend/src/orchestrator/index.ts` | Add `submitHazardToChain` call after scoring |
| `packages/backend/functions/claim-signature/index.ts` | Remove (replaced by on-chain bounty disbursement) |
| `packages/backend/functions/slash-node/index.ts` | Replace ethers/Polygon with `@solana/web3.js` |
| `packages/backend/functions/rewards-balance/index.ts` | Read from Solana NodeStake PDA instead of DynamoDB |
| `packages/infrastructure/lib/stacks/ingestion-stack.ts` | Remove KMS key, add Secrets Manager secret |
| `packages/infrastructure/lib/stacks/intelligence-stack.ts` | Add `SOLANA_RPC_URL`, `SOLANA_PROGRAM_ID`, `SOLANA_AUTHORITY_SECRET_ARN` env vars |

### Deleted files
| File | Reason |
|---|---|
| `packages/contracts/VIGIA_BME.sol` | Replaced by Anchor program |
| `packages/contracts/hardhat.config.ts` | Replaced by Anchor workspace |
| `packages/backend/functions/claim-signature/index.ts` | Bounty is now disbursed on-chain directly by the program |

---

## G. Key Invariants

1. **The Lambda is the only signer** — `VIGIA_AUTHORITY` pubkey is hardcoded in the Anchor program. No user can call `initialize_hazard` or `validate_hazard` directly.
2. **PDA existence = deduplication** — the program's `init` constraint on `initialize_hazard` will fail if the PDA already exists, making double-discovery impossible at the protocol level.
3. **Clock drift is impossible** — both `initialize_hazard` and `validate_hazard` verify `epoch_day == (Clock::get()?.unix_timestamp / 86400) as u32`. A compromised Lambda cannot pass a future or past date to mint extra Discovery Bounties.
4. **One global Merkle tree, not per-cell** — `init_empty_merkle_tree` is never called inside a user-facing instruction. The global tree is pre-initialized by an admin transaction. This avoids CU overflow and eliminates per-cell tree initialization costs.
5. **Compression is mandatory** — `validate_hazard` must always append to the global Merkle tree. Standard account storage for validation events is prohibited.
6. **WebSocket with fallback** — the frontend `useSolanaHazardStream` hook uses `connection.onLogs` for sub-second updates but automatically falls back to 10s REST polling if the WebSocket is silent for 5s, with exponential backoff reconnection (1s → 30s cap).
7. **Ed25519 device identity** — the edge node keypair (browser localStorage) signs the telemetry payload. The Lambda verifies this signature before submitting any transaction. The on-chain `signature_hash` in the Merkle leaf provides a tamper-evident audit trail.
8. **SOL not VGA for bounties** — devnet phase uses native SOL for simplicity. VGA SPL token integration is Phase 2.
