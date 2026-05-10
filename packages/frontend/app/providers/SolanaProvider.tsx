'use client';

import { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import '@solana/wallet-adapter-react-ui/styles.css';

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';

// CSS to hide non-Solana wallets (MetaMask, etc.) from the wallet modal
const HIDE_EVM_WALLETS_CSS = `
  .wallet-adapter-modal-list li[class*="MetaMask"],
  .wallet-adapter-modal-list li[class*="Coinbase"],
  .wallet-adapter-modal-list li[class*="Trust"] {
    display: none !important;
  }
`;

export function SolanaProvider({ children }: { children: React.ReactNode }) {
  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ], []);

  return (
    <ConnectionProvider endpoint={RPC_URL}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>
          <style dangerouslySetInnerHTML={{ __html: HIDE_EVM_WALLETS_CSS }} />
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
