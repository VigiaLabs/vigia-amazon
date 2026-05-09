import { PublicKey } from '@solana/web3.js';

export const PROGRAM_ID = new PublicKey(process.env.SOLANA_PROGRAM_ID || 'BKaxbk73bCY8xRuphpkTESWjaJofdnBpuc2T193f3nkW');

export function deriveHazardPDA(h3Index: bigint, epochDay: number): [PublicKey, number] {
  const h3Buf = Buffer.alloc(8);
  h3Buf.writeBigUInt64LE(h3Index);
  const dayBuf = Buffer.alloc(4);
  dayBuf.writeUInt32LE(epochDay);
  return PublicKey.findProgramAddressSync([Buffer.from('hazard'), h3Buf, dayBuf], PROGRAM_ID);
}

export function deriveNodeStakePDA(nodePubkey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('stake'), nodePubkey.toBuffer()], PROGRAM_ID);
}

export function deriveVaultPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('vault')], PROGRAM_ID);
}

export function deriveMintAuthorityPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('mint_authority')], PROGRAM_ID);
}
