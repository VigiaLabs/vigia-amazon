'use client';

import { AlertTriangle, GitBranch, Settings, Activity } from 'lucide-react';

// ─────────────────────────────────────────────
// TopBar
// ─────────────────────────────────────────────

const C = {
  bg:      '#080B10',
  border:  'rgba(255,255,255,0.07)',
  text:    '#DDE3ED',
  textSec: '#7C8799',
  textMut: '#3D4655',
  accent:  '#3B82F6',
  green:   '#0EA472',
  yellow:  '#E9A23B',
};

interface TopBarProps {
  onSettingsOpen?: () => void;
}

function StatusDot({ label, ok = true }: { label: string; ok?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '0 10px', height: '100%',
      borderRight: `1px solid ${C.border}`,
    }}>
      <span className="pulse" style={{
        width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
        background: ok ? C.green : '#E5484D',
      }} />
      <span style={{ fontSize: '0.66rem', color: C.textMut, fontFamily: 'Inter, sans-serif' }}>
        {label}
      </span>
    </div>
  );
}

export function TopBar({ onSettingsOpen }: TopBarProps) {
  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 32,
      flexShrink: 0,
      background: C.bg,
      borderBottom: `1px solid ${C.border}`,
      userSelect: 'none',
    }}>
      {/* ── Left ──────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
        {/* Logo */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '0 16px', height: '100%',
          borderRight: `1px solid ${C.border}`,
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1"   y="1"   width="5" height="5" stroke="#1D4ED8" strokeWidth="1.3" />
            <rect x="8"   y="1"   width="5" height="5" stroke="#1D4ED8" strokeWidth="1.3" />
            <rect x="1"   y="8"   width="5" height="5" stroke="#3B82F6" strokeWidth="1.3" opacity="0.5" />
            <rect x="8"   y="8"   width="5" height="5" stroke="#3B82F6" strokeWidth="1.3" opacity="0.22" />
          </svg>
          <span style={{ fontSize: '0.76rem', fontWeight: 600, color: C.text, letterSpacing: '-0.02em', fontFamily: 'Inter, sans-serif' }}>
            VIGIA
          </span>
          <span style={{ fontSize: '0.58rem', color: C.textMut, fontFamily: 'JetBrains Mono, monospace' }}>
            v1.0
          </span>
        </div>

        {/* Menu */}
        {['File', 'View', 'Analysis', 'Swarm', 'Ledger', 'Help'].map((item) => (
          <button key={item} style={{
            padding: '0 10px', height: '100%', border: 'none',
            background: 'transparent', color: C.textMut,
            fontSize: '0.7rem', cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            transition: 'background 0.1s, color 0.1s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
            (e.currentTarget as HTMLElement).style.color = C.textSec;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = C.textMut;
          }}>
            {item}
          </button>
        ))}
      </div>

      {/* ── Center ─────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {['vigia', 'road-intelligence', 'workspace'].map((seg, i, arr) => (
          <span key={seg} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              fontSize: '0.66rem',
              color: i === arr.length - 1 ? C.textSec : C.textMut,
              fontFamily: 'Inter, sans-serif',
            }}>
              {seg}
            </span>
            {i < arr.length - 1 && (
              <span style={{ color: C.textMut, opacity: 0.3, fontSize: '0.7rem' }}>/</span>
            )}
          </span>
        ))}
      </div>

      {/* ── Right ──────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', height: '100%', borderLeft: `1px solid ${C.border}` }}>
        <StatusDot label="Edge Online" />
        <StatusDot label="Cloud Sync" />
        <StatusDot label="Ledger Integrity" />

        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '0 10px', height: '100%',
          borderRight: `1px solid ${C.border}`,
        }}>
          <AlertTriangle size={10} style={{ color: C.yellow }} />
          <span style={{ fontSize: '0.65rem', color: C.textMut, fontFamily: 'Inter, sans-serif' }}>
            7 hazards
          </span>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '0 10px', height: '100%',
          borderRight: `1px solid ${C.border}`,
        }}>
          <Activity size={10} style={{ color: C.textMut }} />
          <span style={{ fontSize: '0.65rem', color: C.textMut, fontFamily: 'JetBrains Mono, monospace' }}>
            48 nodes
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 10px', height: '100%', borderRight: `1px solid ${C.border}` }}>
          <GitBranch size={10} style={{ color: C.textMut }} />
          <span style={{ fontSize: '0.65rem', color: C.textMut, fontFamily: 'Inter, sans-serif' }}>main</span>
        </div>

        {/* Settings button */}
        <button
          onClick={onSettingsOpen}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 40, height: '100%', border: 'none',
            background: 'transparent', color: C.textMut, cursor: 'pointer',
            transition: 'background 0.1s, color 0.1s',
          }}
          title="Settings (⌘,)"
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
            (e.currentTarget as HTMLElement).style.color = C.textSec;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = C.textMut;
          }}
        >
          <Settings size={13} />
        </button>
      </div>
    </header>
  );
}
