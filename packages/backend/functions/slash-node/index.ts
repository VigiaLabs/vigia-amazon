import { PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createHash } from 'crypto';
import { getAuthority, getConnection } from '../../src/solana/authority';
import { deriveNodeStakePDA } from '../../src/solana/pda';
import { buildSlashNodeData, buildSlashNodeIx } from '../../src/solana/instructions';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const DEVICE_REGISTRY = process.env.DEVICE_REGISTRY_TABLE!;

export const handler = async (event: { walletAddress: string; hazardId: string; reason: string }) => {
  const { walletAddress, hazardId, reason } = event;
  if (!walletAddress || !hazardId) throw new Error('walletAddress and hazardId required');

  const authority = await getAuthority();
  const connection = getConnection();
  const node = new PublicKey(walletAddress);
  const [nodeStakePDA] = deriveNodeStakePDA(node);

  // bytes32 representation of hazardId (SHA-256 hash, truncated to 32 bytes)
  const hazardIdBytes = createHash('sha256').update(hazardId).digest();

  const data = buildSlashNodeData(hazardIdBytes, reason);
  const ix = buildSlashNodeIx({ nodeStakePDA, node, authority: authority.publicKey, data });

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  const messageV0 = new TransactionMessage({
    payerKey: authority.publicKey,
    recentBlockhash: blockhash,
    instructions: [ix],
  }).compileToV0Message();

  const tx = new VersionedTransaction(messageV0);
  tx.sign([authority]);

  const signature = await connection.sendTransaction(tx, { skipPreflight: false });
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');

  console.log(`[Slash] ✅ node=${walletAddress} hazardId=${hazardId} tx=${signature} reason=${reason}`);

  // Mark blacklisted in DynamoDB DeviceRegistry
  await ddb.send(new UpdateCommand({
    TableName: DEVICE_REGISTRY,
    Key: { device_address: walletAddress },
    UpdateExpression: 'SET blacklisted = :t, slashed_at = :now, slash_reason = :r, slash_tx = :tx',
    ExpressionAttributeValues: { ':t': true, ':now': new Date().toISOString(), ':r': reason, ':tx': signature },
  }));

  return { slashed: true, node: walletAddress, hazardId, txSignature: signature };
};
