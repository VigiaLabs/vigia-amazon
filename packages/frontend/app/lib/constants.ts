// ── Solana Devnet Configuration ───────────────────────────────────────────────
export const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
export const SOLANA_PROGRAM_ID = process.env.NEXT_PUBLIC_SOLANA_PROGRAM_ID || 'BKaxbk73bCY8xRuphpkTESWjaJofdnBpuc2T193f3nkW';
export const SOLANA_CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'devnet';

export const solanaExplorerTx = (sig: string) =>
  `https://explorer.solana.com/tx/${sig}?cluster=${SOLANA_CLUSTER}`;
export const solanaExplorerAddress = (addr: string) =>
  `https://explorer.solana.com/address/${addr}?cluster=${SOLANA_CLUSTER}`;

// ── API URLs ──────────────────────────────────────────────────────────────────
export const INNOVATION_API = process.env.NEXT_PUBLIC_INNOVATION_API_URL!;
export const TELEMETRY_API  = process.env.NEXT_PUBLIC_TELEMETRY_API_URL!;
export const API_URL        = process.env.NEXT_PUBLIC_API_URL!;
