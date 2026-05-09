import { PublicKey, TransactionInstruction, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { getAuthority, getConnection } from './authority';
import { deriveHazardPDA, deriveNodeStakePDA, deriveMintAuthorityPDA, deriveVaultPDA, PROGRAM_ID } from './pda';
import {
  buildInitializeHazardData, buildValidateHazardData,
  buildInitializeHazardIx, buildValidateHazardIx,
  buildAdminStakeNodeData, buildAdminStakeNodeIx,
} from './instructions';

// BigInt JSON safety
(BigInt.prototype as any).toJSON = function () { return this.toString(); };

const VIGIA_MINT = new PublicKey(process.env.VIGIA_MINT_ADDRESS!);
const GLOBAL_TREE = new PublicKey(process.env.GLOBAL_VALIDATION_TREE || 'HUWg7PsuqKtDxUe411mXNssfE2BSpq4ajao4GUab13LZ');
const MIN_STAKE = BigInt(100_000_000); // 0.1 SOL

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

  const [hazardPDA]      = deriveHazardPDA(params.h3Index, params.epochDay);
  const [nodeStakePDA]   = deriveNodeStakePDA(discoverer);
  const [mintAuthority]  = deriveMintAuthorityPDA();
  const [vault]          = deriveVaultPDA();
  const discovererATA    = getAssociatedTokenAddressSync(VIGIA_MINT, discoverer);

  // Check PDA existence in parallel
  const [existingHazard, existingStake] = await Promise.all([
    connection.getAccountInfo(hazardPDA),
    connection.getAccountInfo(nodeStakePDA),
  ]);

  const instructions: TransactionInstruction[] = [];

  // 1. Always: idempotent ATA creation (no-op if exists)
  instructions.push(
    createAssociatedTokenAccountIdempotentInstruction(
      authority.publicKey,
      discovererATA,
      discoverer,
      VIGIA_MINT,
    )
  );

  // 2. If node is unstaked: sponsored admin_stake (authority pays)
  if (!existingStake) {
    console.log(`[Solana] Node ${params.discovererPubkey.slice(0, 8)}... not staked — sponsoring stake`);
    instructions.push(buildAdminStakeNodeIx({
      nodeStakePDA,
      node: discoverer,
      vault,
      authority: authority.publicKey,
      data: buildAdminStakeNodeData(MIN_STAKE),
    }));
  }

  // 3. The actual hazard instruction
  let type: 'DISCOVERY' | 'VALIDATION';

  if (!existingHazard) {
    type = 'DISCOVERY';
    instructions.push(buildInitializeHazardIx({
      hazardPDA, nodeStakePDA, discoverer, discovererATA,
      vigiaMint: VIGIA_MINT, mintAuthority,
      authority: authority.publicKey,
      data: buildInitializeHazardData(
        params.h3Index, params.epochDay,
        Math.round(params.vlmConfidence * 100),
        Math.round(params.onnxConfidence * 100),
      ),
    }));
  } else {
    type = 'VALIDATION';
    instructions.push(buildValidateHazardIx({
      hazardPDA, nodeStakePDA, validator: discoverer, validatorATA: discovererATA,
      vigiaMint: VIGIA_MINT, mintAuthority, globalTree: GLOBAL_TREE,
      authority: authority.publicKey,
      data: buildValidateHazardData(
        params.h3Index, params.epochDay,
        Math.round(params.onnxConfidence * 100),
        params.signatureHash,
      ),
    }));
  }

  // 4. Build + sign + send VersionedTransaction
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  const messageV0 = new TransactionMessage({
    payerKey: authority.publicKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  const tx = new VersionedTransaction(messageV0);
  tx.sign([authority]);

  const signature = await connection.sendTransaction(tx, { skipPreflight: false });
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');

  console.log(`[Solana] ${type} tx=${signature} h3=${params.h3Index.toString()} day=${params.epochDay} ixCount=${instructions.length}`);
  return { type, signature, h3Index: params.h3Index.toString() };
}
