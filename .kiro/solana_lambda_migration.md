# VIGIA — AWS Lambda → Solana Devnet Migration Spec

**Program ID**: `BKaxbk73bCY8xRuphpkTESWjaJofdnBpuc2T193f3nkW`  
**Constraint**: No Anchor IDL. No `@coral-xyz/anchor`. Raw `@solana/web3.js` + `bs58` only.

---

## 1. Dependency Swap

### Uninstall (EVM packages)
```bash
cd packages/backend
npm uninstall ethers ethers-aws-kms-signer @rumblefishdev/eth-signer-kms
```

### Install (Solana packages)
```bash
npm install @solana/web3.js bs58 tweetnacl
```

### Final `dependencies` block in `package.json`
```json
{
  "@aws-sdk/client-bedrock-agent-runtime": "^3.700.0",
  "@aws-sdk/client-bedrock-runtime": "^3.1029.0",
  "@aws-sdk/client-dynamodb": "^3.1030.0",
  "@aws-sdk/client-geo-places": "^3.893.0",
  "@aws-sdk/client-s3": "^3.1029.0",
  "@aws-sdk/client-secrets-manager": "^3.700.0",
  "@aws-sdk/lib-dynamodb": "^3.1030.0",
  "@solana/web3.js": "^1.95.0",
  "bs58": "^5.0.0",
  "tweetnacl": "^1.0.3",
  "h3-js": "^4.4.0",
  "ngeohash": "^0.6.3"
}
```

**Removed**: `ethers`, `ethers-aws-kms-signer`, `@rumblefishdev/eth-signer-kms`, `@aws-sdk/client-kms`  
**Added**: `@solana/web3.js`, `bs58`, `tweetnacl`

---

## 2. Environment Variable Swap

### Remove
```
KMS_KEY_ID=<REDACTED>
VIGIA_CONTRACT_ADDRESS=<REDACTED>
CHAIN_ID=80002
POLYGON_AMOY_RPC_URL=<REDACTED_URL>
RELAYER_PRIVATE_KEY=<REDACTED>
```

### Add
```
SOLANA_RPC_URL=<REDACTED_URL>
SOLANA_PROGRAM_ID=BKaxbk73bCY8xRuphpkTESWjaJofdnBpuc2T193f3nkW
SOLANA_AUTHORITY_SECRET_ARN=arn:aws:secretsmanager:us-east-1:123456789012:secret:vigia-solana-authority-REDACTED
GLOBAL_VALIDATION_TREE=<base58 pubkey of pre-initialized Merkle tree>
```

### Secret format in Secrets Manager (`vigia-solana-authority`)
```json
{
  "privateKey": [<64 bytes as JSON array of numbers>]
}
```
This is `Keypair.secretKey` — a 64-byte Uint8Array stored as a JSON number array.

---

## 3. Authority Keypair Bootstrap

```typescript
// packages/backend/src/solana/authority.ts
import { Keypair, Connection } from '@solana/web3.js';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

let _authority: Keypair | null = null;
let _connection: Connection | null = null;

const sm = new SecretsManagerClient({ region: 'us-east-1' });

export async function getAuthority(): Promise<Keypair> {
  if (_authority) return _authority;
  const { SecretString } = await sm.send(new GetSecretValueCommand({
    SecretId: process.env.SOLANA_AUTHORITY_SECRET_ARN!,
  }));
  const { privateKey } = JSON.parse(SecretString!);
  _authority = Keypair.fromSecretKey(Uint8Array.from(privateKey));
  return _authority;
}

export function getConnection(): Connection {
  if (!_connection) _connection = new Connection(process.env.SOLANA_RPC_URL!, 'confirmed');
  return _connection;
}
```

---

## 4. Instruction Discriminator Calculation

Anchor derives the discriminator from the **`#[program]` module function name** — NOT from any
inner `handler` function. Verified against `vigia_protocol/programs/vigia_protocol/src/lib.rs`:

```rust
// lib.rs — these are the dispatch names Anchor uses:
pub fn initialize_hazard(ctx: Context<InitializeHazard>, ...) { ... }
pub fn validate_hazard(ctx: Context<ValidateHazard>, ...) { ... }
pub fn slash_node(ctx: Context<SlashNode>, ...) { ... }
pub fn stake_node(ctx: Context<StakeNode>, ...) { ... }
```

Each internally calls `module::handler(ctx, ...)` but the discriminator is derived from the
outer function name. The `handler` name is irrelevant.

```typescript
import { createHash } from 'crypto';

function getDiscriminator(instructionName: string): Buffer {
  const hash = createHash('sha256').update(`global:${instructionName}`).digest();
  return hash.subarray(0, 8);
}

// Pre-computed (verified against lib.rs function names):
const INITIALIZE_HAZARD_DISC = getDiscriminator('initialize_hazard');
const VALIDATE_HAZARD_DISC   = getDiscriminator('validate_hazard');
const SLASH_NODE_DISC        = getDiscriminator('slash_node');
const STAKE_NODE_DISC        = getDiscriminator('stake_node');
```

> **Audit note**: If you ever rename the `pub fn` in `lib.rs` (e.g. to `pub fn verify_hazard`),
> the discriminator changes and all existing PDAs become unreachable. Never rename after deploy.

---

## 5. Buffer Payload Construction

### `initialize_hazard(h3_index: u64, epoch_day: u32, vlm_confidence: u8, onnx_confidence: u8)`

```typescript
function buildInitializeHazardData(
  h3Index: bigint,
  epochDay: number,
  vlmConfidence: number,
  onnxConfidence: number,
): Buffer {
  // 8 (disc) + 8 (u64) + 4 (u32) + 1 (u8) + 1 (u8) = 22 bytes
  const buf = Buffer.alloc(22);
  let offset = 0;

  INITIALIZE_HAZARD_DISC.copy(buf, offset); offset += 8;
  buf.writeBigUInt64LE(h3Index, offset);    offset += 8;
  buf.writeUInt32LE(epochDay, offset);      offset += 4;
  buf.writeUInt8(vlmConfidence, offset);    offset += 1;
  buf.writeUInt8(onnxConfidence, offset);   offset += 1;

  return buf;
}
```

### `validate_hazard(h3_index: u64, epoch_day: u32, onnx_confidence: u8, signature_hash: [u8; 32])`

```typescript
function buildValidateHazardData(
  h3Index: bigint,
  epochDay: number,
  onnxConfidence: number,
  signatureHash: Buffer, // 32 bytes
): Buffer {
  // 8 (disc) + 8 (u64) + 4 (u32) + 1 (u8) + 32 (hash) = 53 bytes
  const buf = Buffer.alloc(53);
  let offset = 0;

  VALIDATE_HAZARD_DISC.copy(buf, offset);   offset += 8;
  buf.writeBigUInt64LE(h3Index, offset);    offset += 8;
  buf.writeUInt32LE(epochDay, offset);      offset += 4;
  buf.writeUInt8(onnxConfidence, offset);   offset += 1;
  signatureHash.copy(buf, offset);          offset += 32;

  return buf;
}
```

### `slash_node(hazard_id: [u8; 32], reason: String)`

```typescript
function buildSlashNodeData(hazardId: Buffer, reason: string): Buffer {
  const reasonBytes = Buffer.from(reason, 'utf8');
  // 8 (disc) + 32 (hazard_id) + 4 (string len prefix) + N (string bytes)
  const buf = Buffer.alloc(8 + 32 + 4 + reasonBytes.length);
  let offset = 0;

  SLASH_NODE_DISC.copy(buf, offset);        offset += 8;
  hazardId.copy(buf, offset);               offset += 32;
  buf.writeUInt32LE(reasonBytes.length, offset); offset += 4;
  reasonBytes.copy(buf, offset);

  return buf;
}
```

---

## 6. PDA Derivation

```typescript
import { PublicKey } from '@solana/web3.js';

const PROGRAM_ID = new PublicKey(process.env.SOLANA_PROGRAM_ID!);

function deriveHazardPDA(h3Index: bigint, epochDay: number): [PublicKey, number] {
  const h3Buf = Buffer.alloc(8);
  h3Buf.writeBigUInt64LE(h3Index);
  const dayBuf = Buffer.alloc(4);
  dayBuf.writeUInt32LE(epochDay);

  return PublicKey.findProgramAddressSync(
    [Buffer.from('hazard'), h3Buf, dayBuf],
    PROGRAM_ID,
  );
}

function deriveNodeStakePDA(nodePubkey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('stake'), nodePubkey.toBuffer()],
    PROGRAM_ID,
  );
}

function deriveVaultPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault')],
    PROGRAM_ID,
  );
}
```

---

## 7. AccountMeta Arrays

### `initialize_hazard`

Matches the Rust `InitializeHazard` struct order:

```typescript
import { PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';

function buildInitializeHazardIx(params: {
  hazardPDA: PublicKey;
  nodeStakePDA: PublicKey;
  discoverer: PublicKey;
  vault: PublicKey;
  authority: PublicKey;
  data: Buffer;
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: params.hazardPDA,    isSigner: false, isWritable: true  }, // hazard_registry (init)
      { pubkey: params.nodeStakePDA, isSigner: false, isWritable: false }, // node_stake
      { pubkey: params.discoverer,   isSigner: false, isWritable: true  }, // discoverer (receives bounty)
      { pubkey: params.vault,        isSigner: false, isWritable: true  }, // vault (pays bounty)
      { pubkey: params.authority,    isSigner: true,  isWritable: true  }, // authority (payer for init)
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
    ],
    data: params.data,
  });
}
```

### `validate_hazard`

Matches the Rust `ValidateHazard` struct order:

```typescript
const SPL_NOOP_PROGRAM_ID = new PublicKey('noopb9bkMVfRPU8AsBHBnMs8nnSv8KitCa9az1zMQps');
const SPL_COMPRESSION_PROGRAM_ID = new PublicKey('cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK');

function buildValidateHazardIx(params: {
  hazardPDA: PublicKey;
  nodeStakePDA: PublicKey;
  validator: PublicKey;
  globalTree: PublicKey;
  vault: PublicKey;
  authority: PublicKey;
  data: Buffer;
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: params.hazardPDA,              isSigner: false, isWritable: true  }, // hazard_registry
      { pubkey: params.nodeStakePDA,           isSigner: false, isWritable: false }, // node_stake
      { pubkey: params.validator,              isSigner: false, isWritable: true  }, // validator (receives bounty)
      { pubkey: params.globalTree,             isSigner: false, isWritable: true  }, // global_tree
      { pubkey: params.vault,                  isSigner: false, isWritable: true  }, // vault (pays bounty)
      { pubkey: params.authority,              isSigner: true,  isWritable: true  }, // authority
      { pubkey: SPL_COMPRESSION_PROGRAM_ID,    isSigner: false, isWritable: false }, // compression_program
      { pubkey: SPL_NOOP_PROGRAM_ID,           isSigner: false, isWritable: false }, // noop_program
      { pubkey: SystemProgram.programId,       isSigner: false, isWritable: false }, // system_program
    ],
    data: params.data,
  });
}
```

### `slash_node`

```typescript
function buildSlashNodeIx(params: {
  nodeStakePDA: PublicKey;
  node: PublicKey;
  authority: PublicKey;
  data: Buffer;
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: params.nodeStakePDA,           isSigner: false, isWritable: true  }, // node_stake (closed)
      { pubkey: params.node,                   isSigner: false, isWritable: false }, // node
      { pubkey: SystemProgram.programId,       isSigner: false, isWritable: false }, // burn_sink
      { pubkey: params.authority,              isSigner: true,  isWritable: true  }, // authority
      { pubkey: SystemProgram.programId,       isSigner: false, isWritable: false }, // system_program
    ],
    data: params.data,
  });
}
```

---

## 8. Transaction Dispatch (VersionedTransaction)

Uses modern `VersionedTransaction` + `TransactionMessage` to avoid the internal polling loop
of `sendAndConfirmTransaction`, which risks Lambda timeouts.

**BigInt safety**: `h3Index` is `bigint` for buffer packing only. All logs and return values
use `.toString()` to prevent `JSON.stringify` crashes in Lambda/CloudWatch.

```typescript
import {
  Connection, Keypair, PublicKey, SystemProgram,
  TransactionInstruction, TransactionMessage, VersionedTransaction,
} from '@solana/web3.js';
import { getAuthority, getConnection } from './authority';

// BigInt JSON safety — prevents fatal TypeError in Lambda response serialization
(BigInt.prototype as any).toJSON = function () { return this.toString(); };

export async function submitHazardToChain(params: {
  h3Index: bigint;
  epochDay: number;
  discovererPubkey: string;
  vlmConfidence: number;
  onnxConfidence: number;
  signatureHash: Buffer;
}): Promise<{ type: 'DISCOVERY' | 'VALIDATION'; signature: string; h3Index: string }> {
  const authority = await getAuthority();
  const connection = getConnection();
  const discoverer = new PublicKey(params.discovererPubkey);

  const [hazardPDA]    = deriveHazardPDA(params.h3Index, params.epochDay);
  const [nodeStakePDA] = deriveNodeStakePDA(discoverer);
  const [vault]        = deriveVaultPDA();
  const globalTree     = new PublicKey(process.env.GLOBAL_VALIDATION_TREE!);

  // Check if PDA exists → Discovery vs Validation
  const existing = await connection.getAccountInfo(hazardPDA);

  let ix: TransactionInstruction;
  let type: 'DISCOVERY' | 'VALIDATION';

  if (!existing) {
    type = 'DISCOVERY';
    ix = buildInitializeHazardIx({
      hazardPDA, nodeStakePDA, discoverer, vault,
      authority: authority.publicKey,
      data: buildInitializeHazardData(
        params.h3Index, params.epochDay,
        params.vlmConfidence, params.onnxConfidence,
      ),
    });
  } else {
    type = 'VALIDATION';
    ix = buildValidateHazardIx({
      hazardPDA, nodeStakePDA, validator: discoverer, globalTree, vault,
      authority: authority.publicKey,
      data: buildValidateHazardData(
        params.h3Index, params.epochDay,
        params.onnxConfidence, params.signatureHash,
      ),
    });
  }

  // ── VersionedTransaction dispatch ──────────────────────────────────────────
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

  const messageV0 = new TransactionMessage({
    payerKey: authority.publicKey,
    recentBlockhash: blockhash,
    instructions: [ix],
  }).compileToV0Message();

  const tx = new VersionedTransaction(messageV0);
  tx.sign([authority]);

  const signature = await connection.sendTransaction(tx, { skipPreflight: false });

  // Confirm with explicit timeout control (no internal polling loop)
  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    'confirmed',
  );

  // BigInt-safe logging — .toString() prevents CloudWatch JSON crash
  console.log(`[Solana] ${type} tx=${signature} h3=${params.h3Index.toString()} day=${params.epochDay}`);
  return { type, signature, h3Index: params.h3Index.toString() };
}
```

### Why VersionedTransaction over Legacy Transaction

| Aspect | `sendAndConfirmTransaction` (old) | VersionedTransaction (new) |
|---|---|---|
| RPC calls | 3+ (getBlockhash + send + poll loop) | 3 (getBlockhash + send + confirmTransaction) |
| Timeout risk | High — internal 30s poll loop | Low — single confirmTransaction with explicit blockhash expiry |
| Lambda cost | Higher — longer execution | Lower — deterministic execution time |
| Address Lookup Tables | Not supported | Supported (future optimization) |

---

## 9. Files to Modify

| File | Change |
|---|---|
| `packages/backend/package.json` | Remove ethers/KMS deps, add @solana/web3.js + bs58 + tweetnacl |
| `packages/backend/src/solana/authority.ts` | **New** — Secrets Manager keypair bootstrap |
| `packages/backend/src/solana/submit-hazard.ts` | **New** — raw instruction builder + dispatch |
| `packages/backend/src/solana/pda.ts` | **New** — PDA derivation helpers |
| `packages/backend/src/validator/index.ts` | Replace `ethers.verifyMessage` with `tweetnacl.sign.detached.verify` |
| `packages/backend/src/orchestrator/index.ts` | Add `submitHazardToChain()` call after scoring |
| `packages/backend/functions/slash-node/index.ts` | Replace ethers+Polygon with raw Solana ix |
| `packages/backend/functions/rewards-balance/index.ts` | Remove `ethers.getAddress`, use base58 pubkey directly |
| `packages/backend/functions/claim-signature/index.ts` | **Delete** — bounties are on-chain now |

---

## 10. Validator Lambda — Ed25519 Signature Verification

Replace `ethers.verifyMessage` with `tweetnacl`:

```typescript
import nacl from 'tweetnacl';
import bs58 from 'bs58';

// The payload includes the signer's pubkey (unlike EVM where you recover it)
const { signature, publicKey } = payload;
const payloadStr = `VIGIA:${hazardType}:${lat}:${lon}:${timestamp}:${confidence}`;
const message = new TextEncoder().encode(payloadStr);
const sigBytes = bs58.decode(signature);
const pubkeyBytes = bs58.decode(publicKey);

const valid = nacl.sign.detached.verify(message, sigBytes, pubkeyBytes);
if (!valid) return { statusCode: 401, body: 'INVALID_SIGNATURE' };

// publicKey IS the device address — look it up in DeviceRegistry
const { Item } = await dynamodb.send(new GetCommand({
  TableName: DEVICE_REGISTRY_TABLE,
  Key: { device_address: publicKey }, // base58 string, not 0x hex
}));
if (!Item) return { statusCode: 401, body: 'DEVICE_NOT_REGISTERED' };
```

---

## Key Differences from EVM

| Concept | EVM (old) | Solana (new) |
|---|---|---|
| Address format | `0x` + 40 hex chars | Base58, 44 chars |
| Signature scheme | secp256k1 (ECDSA) | Ed25519 |
| Sig verification | `ethers.verifyMessage` (recovers address) | `nacl.sign.detached.verify` (needs pubkey explicitly) |
| Transaction signing | KMS secp256k1 → DER → Ethereum sig | Secrets Manager Ed25519 keypair → `Keypair.fromSecretKey` |
| Gas | POL (user or relayer pays) | SOL (authority pays, ~0.000005 SOL/tx) |
| Contract call | ABI encoding + `contract.method()` | Raw Buffer: 8-byte discriminator + packed args |
| Block explorer | `amoy.polygonscan.com` | `explorer.solana.com?cluster=devnet` |

---

## Architectural Patches (Audit 2026-05-09)

### Patch 1: Discriminator Naming — VERIFIED CORRECT

**Concern**: Are discriminators derived from `handler` (the inner function) or the outer dispatch name?

**Audit result**: Verified in `vigia_protocol/programs/vigia_protocol/src/lib.rs`. The `#[program]`
module exposes `pub fn initialize_hazard(...)`, `pub fn validate_hazard(...)`, etc. These are the
names Anchor uses for discriminator derivation. The inner `module::handler()` delegation is invisible
to the Anchor runtime. **No change needed.**

### Patch 2: BigInt JSON Crash — APPLIED

**Concern**: `BigInt` values in `JSON.stringify()` throw `TypeError: Do not know how to serialize a BigInt`.

**Where it matters in our codebase**:
- `orchestrator/index.ts` uses `ONE_TOKEN = BigInt('1000000000000000000')` — currently passed to
  DynamoDB via `as any` cast (safe, DynamoDB SDK handles BigInt).
- The new `submitHazardToChain` receives `h3Index: bigint` — if logged raw or returned in a JSON
  response, Lambda crashes.

**Fix applied**:
1. `(BigInt.prototype as any).toJSON = function() { return this.toString(); }` at module top
2. Return value uses `h3Index: params.h3Index.toString()` — never raw bigint
3. `console.log` uses `params.h3Index.toString()` explicitly

### Patch 3: VersionedTransaction — APPLIED

**Concern**: `sendAndConfirmTransaction` has an internal polling loop that can exceed Lambda timeout.

**Fix applied**: Section 8 now uses:
1. `connection.getLatestBlockhash('confirmed')` — single RPC call
2. `TransactionMessage.compileToV0Message()` — modern message format
3. `VersionedTransaction` + `.sign([authority])` — explicit signing
4. `connection.sendTransaction(tx)` — fire
5. `connection.confirmTransaction({signature, blockhash, lastValidBlockHeight})` — single confirm
   with explicit expiry (no polling loop, fails fast if blockhash expires)

**Lambda timeout safety**: worst case is ~5s (getBlockhash 200ms + send 400ms + confirm ~4s).
Previous approach could loop for 30s+ on congested slots.
