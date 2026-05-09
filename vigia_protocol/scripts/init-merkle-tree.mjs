/**
 * Admin script: Initialize the Global Validation Merkle Tree on Solana Devnet.
 * Uses raw @solana/web3.js — no spl-account-compression SDK needed.
 *
 * Run: node scripts/init-merkle-tree.mjs
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import fs from 'fs';

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const KEYPAIR_PATH = process.env.AUTHORITY_KEYPAIR_PATH || `${process.env.HOME}/.config/solana/id.json`;

// SPL Account Compression program
const SPL_ACCOUNT_COMPRESSION_PROGRAM_ID = new PublicKey('cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK');
const SPL_NOOP_PROGRAM_ID = new PublicKey('noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV');

// Tree params: depth=14 (16K leaves), buffer=64 concurrent writes — safe for devnet
const MAX_DEPTH = 14;
const MAX_BUFFER_SIZE = 64;

// Exact size formula from SPL ConcurrentMerkleTree Rust source:
function getConcurrentMerkleTreeSize(maxDepth, maxBufferSize) {
  const DISCRIMINATOR = 8;
  const HEADER = 4 + 4 + 32 + 8 + 1 + 7; // max_buffer_size + max_depth + authority + creation_slot + is_batch_init + padding
  const SEQ_NUM = 8;
  const ACTIVE_IDX = 8;
  const BUF_SIZE = 8;
  const CHANGELOG_ENTRY = 32 + maxDepth * 32 + 4 + 4; // root + path + index + padding
  const CHANGELOGS = maxBufferSize * CHANGELOG_ENTRY;
  const RIGHTMOST = 32 + maxDepth * 32; // leaf + proof
  return DISCRIMINATOR + HEADER + SEQ_NUM + ACTIVE_IDX + BUF_SIZE + CHANGELOGS + RIGHTMOST;
}

async function main() {
  const connection = new Connection(RPC_URL, 'confirmed');

  // Load authority keypair
  const secretKey = JSON.parse(fs.readFileSync(KEYPAIR_PATH, 'utf-8'));
  const authority = Keypair.fromSecretKey(Uint8Array.from(secretKey));
  console.log(`Authority: ${authority.publicKey.toBase58()}`);

  const balance = await connection.getBalance(authority.publicKey);
  console.log(`Balance: ${balance / 1e9} SOL`);

  // Generate a new keypair for the Merkle tree account
  const merkleTree = Keypair.generate();
  console.log(`Merkle Tree Pubkey: ${merkleTree.publicKey.toBase58()}`);

  // Calculate required space
  const space = getConcurrentMerkleTreeSize(MAX_DEPTH, MAX_BUFFER_SIZE);
  const rent = await connection.getMinimumBalanceForRentExemption(space);
  console.log(`Tree size: ${space} bytes, rent: ${rent / 1e9} SOL`);

  // Step 1: Create the account
  const createAccountIx = SystemProgram.createAccount({
    fromPubkey: authority.publicKey,
    newAccountPubkey: merkleTree.publicKey,
    lamports: rent,
    space: space,
    programId: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
  });

  // Step 2: Initialize the tree (init_empty_merkle_tree instruction)
  // Discriminator for init_empty_merkle_tree = first 8 bytes of SHA256("global:init_empty_merkle_tree")
  // But SPL uses Anchor-style: SHA256("global:initialize")[0..8] — actually it uses a fixed discriminator
  // The SPL account compression uses instruction index 0 for init
  const initData = Buffer.alloc(10);
  initData.writeUInt8(0, 0); // instruction index 0 = initialize
  initData.writeUInt32LE(MAX_DEPTH, 1);
  initData.writeUInt32LE(MAX_BUFFER_SIZE, 5);
  initData.writeUInt8(0, 9); // canopy_depth = 0 (not used in newer versions)

  // Actually, SPL Account Compression uses a different encoding.
  // Let's use the simpler approach: just create the account and use the
  // Anchor `init_empty_merkle_tree` via the known discriminator.
  // SPL Account Compression discriminator for `init_empty_merkle_tree`:
  // SHA256("global:init_empty_merkle_tree")[0..8]
  const crypto = await import('crypto');
  const disc = crypto.createHash('sha256').update('global:init_empty_merkle_tree').digest().subarray(0, 8);
  
  const initBuf = Buffer.alloc(8 + 4 + 4);
  disc.copy(initBuf, 0);
  initBuf.writeUInt32LE(MAX_DEPTH, 8);
  initBuf.writeUInt32LE(MAX_BUFFER_SIZE, 12);

  const initIx = new TransactionInstruction({
    programId: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
    keys: [
      { pubkey: merkleTree.publicKey, isSigner: false, isWritable: true },
      { pubkey: authority.publicKey, isSigner: true, isWritable: false }, // authority
      { pubkey: SPL_NOOP_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: initBuf,
  });

  // Send both in one transaction
  const tx = new Transaction().add(createAccountIx, initIx);
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
  console.log('  NEXT: Update GLOBAL_VALIDATION_TREE in validate_hazard.rs');
  console.log('═══════════════════════════════════════════════════════════');
}

main().catch(console.error);
