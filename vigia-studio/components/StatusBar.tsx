'use client';

import { GitBranch, AlertTriangle, CheckCircle, Activity, Cpu, Wifi } from 'lucide-react';

// ─────────────────────────────────────────────
// StatusBar — Bottom application status bar
// ─────────────────────────────────────────────

interface StatusBarProps {
  openTabCount: number;
  activeCityName?: string;
}

export function StatusBar({ openTabCount, activeCityName }: StatusBarProps) {
  return (
    <div
      className="flex items-center justify-between h-5 flex-shrink-0 px-0 select-none"
      style={{
        background: '#1B2028',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Left */}
      <div className="flex items-center h-full">
        {/* Branch / build info */}
        <div
          className="flex items-center gap-1.5 px-3 h-full"
          style={{ background: '#2563EB' }}
        >
          <GitBranch size={10} style={{ color: '#fff' }} />
          <span style={{ fontSize: '0.62rem', color: '#fff', fontWeight: 500 }}>main</span>
        </div>

        <div
          className="flex items-center gap-1.5 px-3 h-full border-r"
          style={{ borderColor: 'rgba(255,255,255,0.07)' }}
        >
          <CheckCircle size={10} className="text-accent-green" />
          <span className="text-text-muted" style={{ fontSize: '0.62rem' }}>
            No errors
          </span>
        </div>

        {activeCityName && (
          <div className="flex items-center gap-1.5 px-3 h-full border-r" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <span className="text-text-muted" style={{ fontSize: '0.62rem', fontFamily: 'JetBrains Mono, monospace' }}>
              {activeCityName}
            </span>
          </div>
        )}

        <div className="flex items-center gap-1.5 px-3 h-full">
          <AlertTriangle size={10} className="text-accent-yellow" />
          <span className="text-text-muted" style={{ fontSize: '0.62rem' }}>
            7 hazards
          </span>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center h-full">
        <div
          className="flex items-center gap-1.5 px-3 h-full border-l"
          style={{ borderColor: 'rgba(255,255,255,0.07)' }}
        >
          <Activity size={10} className="text-text-muted" />
          <span className="text-text-muted" style={{ fontSize: '0.62rem', fontFamily: 'JetBrains Mono, monospace' }}>
            48 nodes
          </span>
        </div>

        <div
          className="flex items-center gap-1.5 px-3 h-full border-l"
          style={{ borderColor: 'rgba(255,255,255,0.07)' }}
        >
          <Cpu size={10} className="text-text-muted" />
          <span className="text-text-muted" style={{ fontSize: '0.62rem', fontFamily: 'JetBrains Mono, monospace' }}>
            GPU 63%
          </span>
        </div>

        <div
          className="flex items-center gap-1.5 px-3 h-full border-l"
          style={{ borderColor: 'rgba(255,255,255,0.07)' }}
        >
          <Wifi size={10} className="text-text-muted" />
          <span className="text-text-muted" style={{ fontSize: '0.62rem', fontFamily: 'JetBrains Mono, monospace' }}>
            8ms
          </span>
        </div>

        <div
          className="flex items-center gap-1.5 px-3 h-full border-l"
          style={{ borderColor: 'rgba(255,255,255,0.07)' }}
        >
          <span className="text-text-muted" style={{ fontSize: '0.62rem' }}>
            {openTabCount} open
          </span>
        </div>

        <div
          className="flex items-center gap-1.5 px-3 h-full border-l"
          style={{ borderColor: 'rgba(255,255,255,0.07)' }}
        >
          <span className="text-text-muted" style={{ fontSize: '0.62rem' }}>
            GeoJSON · UTF-8
          </span>
        </div>
      </div>
    </div>
  );
}
