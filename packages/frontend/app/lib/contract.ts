import { SOLANA_RPC_URL, SOLANA_PROGRAM_ID } from './constants';

/**
 * Solana on-chain reads. Bounties are disbursed on-chain by the program directly —
 * no claimRewards or burnForDataCredits calls from the frontend.
 * These helpers read PDA state for display purposes.
 */

/** Read the vault PDA balance (total bounty pool remaining) */
export async function readVaultBalance(): Promise<number> {
  const res = await fetch(SOLANA_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'getBalance',
      params: ['3JiWf9TN3NaXHCmJdNuPVBbW6RxNFhfehXFgb3DuScYz'], // vault PDA
    }),
  });
  const { result } = await res.json();
  return (result?.value ?? 0) / 1e9; // lamports → SOL
}

/** Read recent program transactions (for activity feed) */
export async function readRecentTransactions(limit = 10): Promise<Array<{ signature: string; slot: number }>> {
  const res = await fetch(SOLANA_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'getSignaturesForAddress',
      params: [SOLANA_PROGRAM_ID, { limit }],
    }),
  });
  const { result } = await res.json();
  return (result ?? []).map((s: any) => ({ signature: s.signature, slot: s.slot }));
}
