# VIGIA — Solana Burn-and-Mint Equilibrium (BME) Design Spec

**Status**: Draft — Awaiting Approval  
**Supersedes**: Direct SOL bounty payouts from vault PDA  
**Program ID**: `BKaxbk73bCY8xRuphpkTESWjaJofdnBpuc2T193f3nkW`

---

## Architecture Shift

**Before**: Vault PDA holds SOL → `system_program::transfer` pays SOL bounties directly.  
**After**: Program is the Mint Authority for $VIGIA SPL Token → `token::mint_to` mints fresh tokens to the discoverer/validator's ATA.

This is a true BME model:
- **Mint**: New $VIGIA tokens are minted on every verified hazard (inflationary supply tied to real-world utility)
- **Burn**: Enterprises burn $VIGIA for Data Credits (deflationary pressure from demand)
- **Equilibrium**: Supply grows with network activity, shrinks with enterprise consumption

No vault needed. No pre-funded SOL pool. The program mints tokens from nothing — the mint authority is a PDA controlled by the program.

---

## Target 1: Rust Smart Contract Upgrade

### 1a. Cargo.toml

Add `anchor-spl` for the `token::mint_to` CPI:

```toml
[dependencies]
anchor-lang = "0.30.1"
anchor-spl = "0.30.1"
spl-account-compression = { version = "0.3.2", features = ["no-entrypoint"] }
spl-noop = "0.2.0"
```

### 1b. New State: Mint Authority PDA

```rust
// Seeds: ["mint_authority"]
// This PDA is set as the mint authority of the $VIGIA SPL token at deployment time.
// Only the program can sign mint_to instructions via this PDA.
pub const MINT_AUTHORITY_SEED: &[u8] = b"mint_authority";
```

The $VIGIA mint is created externally (via `spl-token create-token`) with the mint authority set to this PDA. The program then uses PDA signer seeds to authorize `mint_to`.

### 1c. Updated `InitializeHazard` Accounts

```rust
#[derive(Accounts)]
#[instruction(h3_index: u64, epoch_day: u32)]
pub struct InitializeHazard<'info> {
    #[account(init, payer = authority, space = HAZARD_REGISTRY_SIZE,
        seeds = [b"hazard", &h3_index.to_le_bytes() as &[u8], &epoch_day.to_le_bytes() as &[u8]], bump)]
    pub hazard_registry: Account<'info, HazardRegistry>,

    /// CHECK: discoverer's Ed25519 pubkey
    pub discoverer: UncheckedAccount<'info>,

    /// The discoverer's $VIGIA Associated Token Account (receives minted tokens)
    #[account(mut)]
    pub discoverer_ata: UncheckedAccount<'info>,

    /// The $VIGIA SPL Token mint
    #[account(mut)]
    pub vigia_mint: UncheckedAccount<'info>,

    /// The mint authority PDA (program-controlled)
    /// CHECK: derived from seeds ["mint_authority"]
    #[account(seeds = [MINT_AUTHORITY_SEED], bump)]
    pub mint_authority: UncheckedAccount<'info>,

    #[account(mut, constraint = authority.key().to_string() == VIGIA_AUTHORITY)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}
```

### 1d. Replace `system_program::transfer` with `token::mint_to`

```rust
// Instead of transferring SOL from vault:
// system_program::transfer(vault → discoverer, DISCOVERY_BOUNTY_LAMPORTS)

// Mint fresh $VIGIA tokens to the discoverer's ATA:
let mint_authority_bump = ctx.bumps.mint_authority;
let signer_seeds: &[&[u8]] = &[MINT_AUTHORITY_SEED, &[mint_authority_bump]];

token::mint_to(
    CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        token::MintTo {
            mint: ctx.accounts.vigia_mint.to_account_info(),
            to: ctx.accounts.discoverer_ata.to_account_info(),
            authority: ctx.accounts.mint_authority.to_account_info(),
        },
        &[signer_seeds],
    ),
    DISCOVERY_BOUNTY_TOKENS, // e.g. 10_000_000 = 10 $VIGIA (6 decimals)
)?;
```

### 1e. Bounty Amounts (SPL Token, 6 decimals)

```rust
pub const DISCOVERY_BOUNTY_TOKENS: u64 = 10_000_000;   // 10 $VIGIA
pub const VALIDATION_BOUNTY_TOKENS: u64 = 100_000;     // 0.1 $VIGIA
```

### 1f. `ValidateHazard` — Same Pattern

Same accounts added (`discoverer_ata` → `validator_ata`, `vigia_mint`, `mint_authority`, `token_program`). Same `mint_to` CPI with `VALIDATION_BOUNTY_TOKENS`.

### 1g. What Gets Removed

- `vault` PDA — no longer needed (tokens are minted, not transferred)
- `system_program::transfer` for bounties — replaced by `token::mint_to`
- Vault funding step — eliminated entirely

---

## Target 2: AWS Lambda ATA Optimization

### 2a. Dependencies

```bash
npm install @solana/spl-token
```

### 2b. ATA Calculation (No RPC call)

```typescript
import { getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';

const VIGIA_MINT = new PublicKey(process.env.VIGIA_MINT_ADDRESS!);

// Deterministic — no RPC call needed
const discovererATA = getAssociatedTokenAddressSync(VIGIA_MINT, discoverer);
```

### 2c. Idempotent ATA Creation (Prepended to Transaction)

**TRAP PREVENTION**: Do NOT use `getOrCreateAssociatedTokenAccount` — it fires 2 RPC calls internally and risks Lambda timeout.

Instead, always prepend `createAssociatedTokenAccountIdempotentInstruction` — it's a no-op if the ATA already exists (costs nothing extra):

```typescript
const instructions: TransactionInstruction[] = [];

// Always prepend — idempotent, no-op if ATA exists
instructions.push(
  createAssociatedTokenAccountIdempotentInstruction(
    authority.publicKey,  // payer
    discovererATA,        // ATA address
    discoverer,           // owner
    VIGIA_MINT,           // mint
  )
);

// Then the actual hazard instruction
instructions.push(hazardIx);

// Build VersionedTransaction with both instructions
const messageV0 = new TransactionMessage({
  payerKey: authority.publicKey,
  recentBlockhash: blockhash,
  instructions,
}).compileToV0Message();
```

This guarantees the ATA exists before `mint_to` executes, in a single atomic transaction.

---

## Target 3: Raw Buffer AccountMeta Update

### 3a. `initialize_hazard` Keys Array (New Order)

```typescript
const SPL_TOKEN_PROGRAM = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

function buildInitializeHazardIx(p: {
  hazardPDA: PublicKey;
  discoverer: PublicKey;
  discovererATA: PublicKey;
  vigiaMint: PublicKey;
  mintAuthority: PublicKey;
  authority: PublicKey;
  data: Buffer;
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: p.hazardPDA,       isSigner: false, isWritable: true  }, // hazard_registry (init)
      { pubkey: p.discoverer,      isSigner: false, isWritable: false }, // discoverer
      { pubkey: p.discovererATA,   isSigner: false, isWritable: true  }, // discoverer_ata (receives tokens)
      { pubkey: p.vigiaMint,       isSigner: false, isWritable: true  }, // vigia_mint (supply increases)
      { pubkey: p.mintAuthority,   isSigner: false, isWritable: false }, // mint_authority PDA
      { pubkey: p.authority,       isSigner: true,  isWritable: true  }, // authority (payer)
      { pubkey: SPL_TOKEN_PROGRAM, isSigner: false, isWritable: false }, // token_program
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
    ],
    data: p.data,
  });
}
```

### 3b. `validate_hazard` Keys Array (New Order)

```typescript
function buildValidateHazardIx(p: {
  hazardPDA: PublicKey;
  nodeStakePDA: PublicKey;
  validator: PublicKey;
  validatorATA: PublicKey;
  vigiaMint: PublicKey;
  mintAuthority: PublicKey;
  globalTree: PublicKey;
  authority: PublicKey;
  data: Buffer;
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: p.hazardPDA,       isSigner: false, isWritable: true  }, // hazard_registry
      { pubkey: p.nodeStakePDA,    isSigner: false, isWritable: false }, // node_stake
      { pubkey: p.validator,       isSigner: false, isWritable: false }, // validator
      { pubkey: p.validatorATA,    isSigner: false, isWritable: true  }, // validator_ata
      { pubkey: p.vigiaMint,       isSigner: false, isWritable: true  }, // vigia_mint
      { pubkey: p.mintAuthority,   isSigner: false, isWritable: false }, // mint_authority PDA
      { pubkey: p.globalTree,      isSigner: false, isWritable: true  }, // global_tree
      { pubkey: p.authority,       isSigner: true,  isWritable: true  }, // authority
      { pubkey: SPL_COMPRESSION,   isSigner: false, isWritable: false }, // compression_program
      { pubkey: SPL_NOOP,          isSigner: false, isWritable: false }, // noop_program
      { pubkey: SPL_TOKEN_PROGRAM, isSigner: false, isWritable: false }, // token_program
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
    ],
    data: p.data,
  });
}
```

### 3c. Mint Authority PDA Derivation

```typescript
const [mintAuthority] = PublicKey.findProgramAddressSync(
  [Buffer.from('mint_authority')],
  PROGRAM_ID,
);
```

---

## Deployment Steps

1. Create $VIGIA SPL Token mint: `spl-token create-token --decimals 6`
2. Set mint authority to the program's `mint_authority` PDA: `spl-token authorize <MINT> mint <MINT_AUTHORITY_PDA>`
3. Update Rust constants with mint address
4. Rebuild + redeploy program
5. Update Lambda env: `VIGIA_MINT_ADDRESS=<mint pubkey>`
6. Redeploy Lambda

---

## What Gets Removed

| Component | Reason |
|---|---|
| Vault PDA (`["vault"]`) | No longer needed — tokens are minted, not transferred |
| `deriveVaultPDA()` | Removed from Lambda |
| Vault funding step | Eliminated — infinite mint capacity |
| SOL balance display in RewardsWidget | Replaced with $VIGIA token balance |

---

## Tokenomics Summary

| Event | Tokens Minted | Recipient |
|---|---|---|
| Discovery Bounty (new H3 cell today) | 10 $VIGIA | Discoverer's ATA |
| Validation Bounty (confirm existing) | 0.1 $VIGIA | Validator's ATA |
| Enterprise Data Credit Purchase | — (burn) | Burned from enterprise wallet |

**Supply**: Uncapped (grows with network activity)  
**Deflation**: Enterprise burns create deflationary pressure  
**Equilibrium**: More hazards detected → more tokens minted → more enterprise demand → more burns

---

## Files to Modify

### Rust
- `programs/vigia_protocol/Cargo.toml` — add `anchor-spl`
- `src/constants.rs` — add `MINT_AUTHORITY_SEED`, `DISCOVERY_BOUNTY_TOKENS`, `VALIDATION_BOUNTY_TOKENS`, `VIGIA_MINT`
- `src/instructions/initialize_hazard.rs` — new accounts + `mint_to` CPI
- `src/instructions/validate_hazard.rs` — new accounts + `mint_to` CPI

### TypeScript (Lambda)
- `packages/backend/src/solana/instructions.ts` — new AccountMeta arrays
- `packages/backend/src/solana/submit-hazard.ts` — ATA calculation + idempotent creation
- `packages/backend/src/solana/pda.ts` — add `deriveMintAuthorityPDA`, remove `deriveVaultPDA`

### Frontend
- `RewardsWidget.tsx` — show $VIGIA token balance instead of SOL balance

---

*Awaiting your GO to implement.*
