import { createHash } from 'crypto';
import { PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { PROGRAM_ID } from './pda';

// ── Discriminators ────────────────────────────────────────────────────────────
function disc(name: string): Buffer {
  return createHash('sha256').update(`global:${name}`).digest().subarray(0, 8);
}
const INITIALIZE_HAZARD_DISC = disc('initialize_hazard');
const VALIDATE_HAZARD_DISC   = disc('validate_hazard');
const SLASH_NODE_DISC        = disc('slash_node');
const ADMIN_STAKE_NODE_DISC  = disc('admin_stake_node');

// ── Well-known program IDs ────────────────────────────────────────────────────
const SPL_COMPRESSION = new PublicKey('cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK');
const SPL_NOOP        = new PublicKey('noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV');

// ── Buffer builders ───────────────────────────────────────────────────────────

export function buildInitializeHazardData(h3Index: bigint, epochDay: number, vlmConf: number, onnxConf: number): Buffer {
  const buf = Buffer.alloc(22);
  INITIALIZE_HAZARD_DISC.copy(buf, 0);
  buf.writeBigUInt64LE(h3Index, 8);
  buf.writeUInt32LE(epochDay, 16);
  buf.writeUInt8(vlmConf, 20);
  buf.writeUInt8(onnxConf, 21);
  return buf;
}

export function buildValidateHazardData(h3Index: bigint, epochDay: number, onnxConf: number, signatureHash: Buffer): Buffer {
  const buf = Buffer.alloc(53);
  VALIDATE_HAZARD_DISC.copy(buf, 0);
  buf.writeBigUInt64LE(h3Index, 8);
  buf.writeUInt32LE(epochDay, 16);
  buf.writeUInt8(onnxConf, 20);
  signatureHash.copy(buf, 21);
  return buf;
}

export function buildSlashNodeData(hazardId: Buffer, reason: string): Buffer {
  const reasonBytes = Buffer.from(reason, 'utf8');
  const buf = Buffer.alloc(8 + 32 + 4 + reasonBytes.length);
  SLASH_NODE_DISC.copy(buf, 0);
  hazardId.copy(buf, 8);
  buf.writeUInt32LE(reasonBytes.length, 40);
  reasonBytes.copy(buf, 44);
  return buf;
}

export function buildAdminStakeNodeData(amount: bigint): Buffer {
  const buf = Buffer.alloc(16);
  ADMIN_STAKE_NODE_DISC.copy(buf, 0);
  buf.writeBigUInt64LE(amount, 8);
  return buf;
}

// ── Instruction builders ──────────────────────────────────────────────────────

export function buildInitializeHazardIx(p: {
  hazardPDA: PublicKey; nodeStakePDA: PublicKey; discoverer: PublicKey;
  discovererATA: PublicKey; vigiaMint: PublicKey; mintAuthority: PublicKey;
  authority: PublicKey; data: Buffer;
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: p.hazardPDA,       isSigner: false, isWritable: true  }, // hazard_registry (init)
      { pubkey: p.nodeStakePDA,    isSigner: false, isWritable: false }, // node_stake
      { pubkey: p.discoverer,      isSigner: false, isWritable: false }, // discoverer
      { pubkey: p.discovererATA,   isSigner: false, isWritable: true  }, // discoverer_ata
      { pubkey: p.vigiaMint,       isSigner: false, isWritable: true  }, // vigia_mint
      { pubkey: p.mintAuthority,   isSigner: false, isWritable: false }, // mint_authority PDA
      { pubkey: p.authority,       isSigner: true,  isWritable: true  }, // authority (payer)
      { pubkey: TOKEN_PROGRAM_ID,  isSigner: false, isWritable: false }, // token_program
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
    ],
    data: p.data,
  });
}

export function buildValidateHazardIx(p: {
  hazardPDA: PublicKey; nodeStakePDA: PublicKey; validator: PublicKey;
  validatorATA: PublicKey; vigiaMint: PublicKey; mintAuthority: PublicKey;
  globalTree: PublicKey; authority: PublicKey; data: Buffer;
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
      { pubkey: TOKEN_PROGRAM_ID,  isSigner: false, isWritable: false }, // token_program
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
    ],
    data: p.data,
  });
}

export function buildSlashNodeIx(p: {
  nodeStakePDA: PublicKey; node: PublicKey; authority: PublicKey; data: Buffer;
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: p.nodeStakePDA,           isSigner: false, isWritable: true  },
      { pubkey: p.node,                   isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId,  isSigner: false, isWritable: false },
      { pubkey: p.authority,              isSigner: true,  isWritable: true  },
      { pubkey: SystemProgram.programId,  isSigner: false, isWritable: false },
    ],
    data: p.data,
  });
}

export function buildAdminStakeNodeIx(p: {
  nodeStakePDA: PublicKey; node: PublicKey; vault: PublicKey; authority: PublicKey; data: Buffer;
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: p.nodeStakePDA,           isSigner: false, isWritable: true  },
      { pubkey: p.node,                   isSigner: false, isWritable: false },
      { pubkey: p.vault,                  isSigner: false, isWritable: true  },
      { pubkey: p.authority,              isSigner: true,  isWritable: true  },
      { pubkey: SystemProgram.programId,  isSigner: false, isWritable: false },
    ],
    data: p.data,
  });
}
