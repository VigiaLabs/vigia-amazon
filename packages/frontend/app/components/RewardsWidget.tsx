'use client';

import { useState, useEffect } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { solanaExplorerAddress } from '../lib/constants';
import { useDeviceWallet } from '../hooks/useDeviceWallet';

const C = {
  panel:   'var(--c-panel)',
  border:  'var(--c-border)',
  text:    'var(--c-text)',
  textMut: 'var(--c-text-3)',
  accent:  'var(--c-accent-2)',
  green:   'var(--c-green)',
};

const VIGIA_MINT = new PublicKey(process.env.NEXT_PUBLIC_VIGIA_MINT || '5UXva9WVVQ5oxHTjf5tqryi94crHWNFbW84qRV1fBLTa');

export function RewardsWidget() {
  const { connection } = useConnection();
  const device = useDeviceWallet();
  const [tokenBalance, setTokenBalance] = useState<string | null>(null);

  useEffect(() => {
    if (device.status !== 'ready' || !device.address) { setTokenBalance(null); return; }
    const fetchBal = async () => {
      try {
        const owner = new PublicKey(device.address);
        const ata = getAssociatedTokenAddressSync(VIGIA_MINT, owner);
        const bal = await connection.getTokenAccountBalance(ata);
        setTokenBalance(bal.value.uiAmountString ?? '0');
      } catch {
        setTokenBalance('0');
      }
    };
    fetchBal();
    const id = setInterval(fetchBal, 10000);
    return () => clearInterval(id);
  }, [device.status, device.address, connection]);

  const addr = device.address;

  return (
    <div style={{
      background: C.panel,
      border: `1px solid ${C.border}`,
      borderRadius: 6,
      padding: '10px 12px',
      fontFamily: 'var(--v-font-mono)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: '0.65rem', color: C.accent, letterSpacing: '0.08em', fontWeight: 700 }}>
          $VIGIA REWARDS
        </span>
        {addr && (
          <a href={solanaExplorerAddress(addr)} target="_blank" rel="noreferrer"
            style={{ marginLeft: 'auto', fontSize: '0.58rem', color: C.textMut, textDecoration: 'none' }}>
            {addr.slice(0, 6)}…{addr.slice(-4)} ↗
          </a>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: '1.2rem', fontWeight: 700, color: tokenBalance && parseFloat(tokenBalance) > 0 ? C.green : C.text }}>
          {tokenBalance ?? '—'}
        </span>
        <span style={{ fontSize: '0.65rem', color: C.textMut }}>$VIGIA</span>
      </div>

      <div style={{ marginTop: 8, fontSize: '0.58rem', color: C.textMut, lineHeight: 1.5 }}>
        Tokens minted directly to your edge node on-chain.
        <br />Discovery: 10 $VIGIA · Validation: 0.1 $VIGIA
      </div>
    </div>
  );
}
