'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, ExternalLink } from 'lucide-react';

type LedgerEntry = {
  contributorId: string;
  credits: number;
  hazardId: string;
  timestamp: string;
  txHash?: string;
};

export function LedgerTicker() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEntries = async () => {
    try {
      // Fetch DynamoDB ledger entries (has contributor + geohash)
      const response = await fetch('/api/ledger');
      const data = await response.json();
      const dbEntries: LedgerEntry[] = (data.entries || []);

      // Fetch recent Solana program tx signatures
      const solRes = await fetch(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSignaturesForAddress',
          params: [process.env.NEXT_PUBLIC_SOLANA_PROGRAM_ID || 'BKaxbk73bCY8xRuphpkTESWjaJofdnBpuc2T193f3nkW', { limit: 10 }] }),
      });
      const solData = await solRes.json();
      const solSigs: string[] = (solData.result ?? []).map((s: any) => s.signature);

      // Attach Solana tx signatures to the most recent DB entries (in order)
      const merged = dbEntries.map((entry, i) => ({
        ...entry,
        txHash: entry.txHash || solSigs[i] || undefined,
      }));

      setEntries(merged.slice(0, 15));
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch ledger entries:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
    const interval = setInterval(fetchEntries, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-ide-text-secondary font-data" style={{ fontSize: '0.82rem' }}>
        <RefreshCw size={14} className="animate-spin" />
        <span>Loading ledger entries...</span>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex items-center gap-2 text-ide-text-secondary font-data" style={{ fontSize: '0.82rem' }}>
        <span className="animate-pulse text-ide-accent-2">›</span>
        <span>Awaiting network consensus...</span>
      </div>
    );
  }

  return (
    <div className="font-data w-full h-full flex flex-col" style={{ fontSize: '0.78rem' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="vigia-panel-header" style={{ borderBottom: 'none' }}>
              {['Timestamp', 'Contributor', 'Hazard Type', 'Location', 'Reward'].map((h, i) => (
                <th
                  key={h}
                  className="py-2 px-3 text-left font-medium uppercase tracking-widest"
                  style={{
                    fontSize: '0.7rem',
                    color: 'var(--c-text-3)',
                    letterSpacing: '0.08em',
                    textAlign: i === 4 ? 'right' : 'left',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, index) => (
              <tr
                key={`${entry.contributorId}-${entry.timestamp}-${index}`}
                className="transition-colors group"
                style={{ borderBottom: '1px solid var(--c-border)' }}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'var(--c-hover)'}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = ''}
              >
                <td className="py-2 px-3" style={{ color: 'var(--c-text-2)' }}>
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </td>
                <td className="py-2 px-3" style={{ color: 'var(--c-text-2)', fontFamily: 'var(--v-font-mono)' }}>
                  {entry.contributorId.slice(0, 6)}…{entry.contributorId.slice(-4)}
                  <span style={{ color: 'var(--c-text-3)' }}>…</span>
                </td>
                <td className="py-2 px-3">
                  <span
                    className="px-2 py-1 rounded"
                    style={{
                      background: 'var(--c-red-dim)',
                      color: 'var(--c-red)',
                      fontSize: '0.70rem',
                      fontWeight: 600,
                      fontFamily: 'var(--v-font-mono)',
                    }}
                  >
                    POTHOLE
                  </span>
                </td>
                <td className="py-2 px-3" style={{ color: 'var(--c-text-2)', fontFamily: 'var(--v-font-mono)' }}>
                  {entry.hazardId.substring(0, 7)}
                </td>
                <td className="py-2 px-3 text-right">
                  {entry.txHash ? (
                    <a
                      href={`https://explorer.solana.com/tx/${entry.txHash}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        color: 'var(--c-green)',
                        fontWeight: 600,
                        fontFamily: 'var(--v-font-mono)',
                        textDecoration: 'none',
                      }}
                      title={`View on PolygonScan: ${entry.txHash}`}
                    >
                      <span>{entry.credits > 0 ? '✓ On-Chain' : '—'}</span>
                      <ExternalLink size={10} />
                    </a>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: 'var(--c-text-3)', fontFamily: 'var(--v-font-mono)' }}>
                        {entry.credits > 0 ? '✓ On-Chain' : '—'}
                      </span>
                      <span style={{
                        fontSize: '0.58rem', padding: '1px 5px', borderRadius: 2,
                        background: 'var(--c-elevated)', color: 'var(--c-text-3)',
                        border: '1px solid var(--c-border)', fontFamily: 'var(--v-font-mono)',
                        letterSpacing: '0.04em', textTransform: 'uppercase',
                      }}>
                        Off-Chain Ledger
                      </span>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
