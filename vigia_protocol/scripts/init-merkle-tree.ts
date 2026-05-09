/**
 * Admin script: Initialize the Global Validation Merkle Tree on Solana Devnet.
 *
 * Run: npx ts-node scripts/init-merkle-tree.ts
 *
 * Prerequisites:
 *   - `solana config set --url devnet`
 *   - Authority keypair at ~/.config/solana/id.json (or set AUTHORITY_KEYPAIR_PATH)
 *   - Authority has ~2 SOL on devnet for rent
 *
 * Output: prints the Merkle tree pubkey to hardcode in validate_hazard.rs
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  createAllocTreeIx,
  SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
  SPL_NOOP_PROGRAM_ID,
} from '@solana/spl-account-compression';
import fs from 'fs';

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const KEYPAIR_PATH = process.env.AUTHORITY_KEYPAIR_PATH || `${process.env.HOME}/.config/solana/id.json`;

// Tree sizing — 2^20 = ~1 million leaves, sufficient for devnet testing
const MAX_DEPTH = 20;
const MAX_BUFFER_SIZE = 256;
const CANOPY_DEPTH = 0; // no canopy needed for authority-only writes

async function main() {
  const connection = new Connection(RPC_URL, 'confirmed');

  // Load authority keypair
  const secretKey = JSON.parse(fs.readFileSync(KEYPAIR_PATH, 'utf-8'));
  const authority = Keypair.fromSecretKey(Uint8Array.from(secretKey));
  console.log(`Authority: ${authority.publicKey.toBase58()}`);

  // Generate a new keypair for the Merkle tree account
  const merkleTree = Keypair.generate();
  console.log(`Merkle Tree Pubkey: ${merkleTree.publicKey.toBase58()}`);

  // Calculate space needed for the tree
  const allocIx = await createAllocTreeIx(
    connection,
    merkleTree.publicKey,
    authority.publicKey,
    { maxDepth: MAX_DEPTH, maxBufferSize: MAX_BUFFER_SIZE },
    CANOPY_DEPTH,
  );

  // Send transaction
  const tx = new Transaction().add(allocIx);
  const sig = await sendAndConfirmTransaction(connection, tx, [authority, merkleTree], {
    commitment: 'confirmed',
  });

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  ✅ Global Merkle Tree Initialized');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Pubkey:    ${merkleTree.publicKey.toBase58()}`);
  console.log(`  Authority: ${authority.publicKey.toBase58()}`);
  console.log(`  Depth:     ${MAX_DEPTH} (${Math.pow(2, MAX_DEPTH).toLocaleString()} max leaves)`);
  console.log(`  Buffer:    ${MAX_BUFFER_SIZE} concurrent writes`);
  console.log(`  Tx:        ${sig}`);
  console.log('');
  console.log('  NEXT STEP: Copy the pubkey above into:');
  console.log('  vigia_protocol/programs/vigia_protocol/src/instructions/validate_hazard.rs');
  console.log('  → Replace GLOBAL_VALIDATION_TREE constant');
  console.log('═══════════════════════════════════════════════════════════');
}

main().catch(console.error);
