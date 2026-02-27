'use client';

import { useEffect, useRef } from 'react';
import {
  AlertTriangle,
  Database,
  Radio,
  Server,
  Play,
  Pause,
  Trash2,
  Terminal as TerminalIcon,
  ChevronUp,
} from 'lucide-react';
import { UseTerminalReturn } from '@/hooks/useTerminal';
import { TerminalTabId, TerminalLog } from '@/types';
import { CATEGORY_COLORS, SEVERITY_COLORS } from '@/lib/mockData';

interface TerminalProps {
  terminal: UseTerminalReturn;
  height: number;
  onResizeStart: (e: React.MouseEvent) => void;
}

// ─────────────────────────────────────────────
// Tab definitions
// ─────────────────────────────────────────────

const TERMINAL_TABS: { id: TerminalTabId; icon: React.ReactNode; count?: string }[] = [
  { id: 'Hazards', icon: <AlertTriangle size={11} /> },
  { id: 'Ledger', icon: <Database size={11} /> },
  { id: 'Swarm', icon: <Radio size={11} /> },
  { id: 'System', icon: <Server size={11} /> },
];

// ─────────────────────────────────────────────
// Log Line renderer
// ─────────────────────────────────────────────

interface LogLineProps {
  log: TerminalLog;
  index: number;
}

function LogLine({ log, index }: LogLineProps) {
  const categoryColor = CATEGORY_COLORS[log.category];
  const severityColor = SEVERITY_COLORS[log.severity];
  const isRecent = index >= 0; // All lines animate

  return (
    <div
      className="log-line flex items-start gap-0 py-0.5 font-mono group"
      style={{
        fontFamily: 'JetBrains Mono, Fira Code, monospace',
        fontSize: '0.72rem',
        lineHeight: '1.5',
      }}
    >
      {/* Timestamp */}
      <span className="select-none text-text-muted mr-2 flex-shrink-0" style={{ color: '#3D4451' }}>
        [{log.timestamp}]
      </span>

      {/* Category */}
      <span
        className="mr-2 flex-shrink-0 font-medium"
        style={{
          color: categoryColor,
          minWidth: '6ch',
          display: 'inline-block',
        }}
      >
        {log.category}
      </span>

      {/* Separator */}
      <span className="mr-2 text-text-muted select-none" style={{ color: '#2D3440' }}>
        │
      </span>

      {/* Severity */}
      <span
        className="mr-2 flex-shrink-0"
        style={{ color: severityColor, minWidth: '7ch', display: 'inline-block' }}
      >
        {log.severity}
      </span>

      {/* Separator */}
      <span className="mr-2 text-text-muted select-none" style={{ color: '#2D3440' }}>
        │
      </span>

      {/* Message */}
      <span style={{ color: '#9CA3AF' }}>
        {log.message}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Terminal Component
// ─────────────────────────────────────────────

export function Terminal({ terminal, height, onResizeStart }: TerminalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottom = useRef(true);

  // Track scroll position
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => {
      isAtBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    };
    el.addEventListener('scroll', handler);
    return () => el.removeEventListener('scroll', handler);
  }, []);

  // Auto-scroll when new logs arrive
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !isAtBottom.current) return;
    el.scrollTop = el.scrollHeight;
  }, [terminal.logs]);

  return (
    <div
      className="flex flex-col flex-shrink-0"
      style={{ height, borderTop: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Resize handle */}
      <div
        className="resize-handle h-3 flex-shrink-0 flex items-center justify-center select-none"
        style={{ background: '#161B22', cursor: 'ns-resize' }}
        onMouseDown={onResizeStart}
      >
        <div className="flex gap-1 items-center">
          <div className="w-8 h-0.5 rounded" style={{ background: 'rgba(255,255,255,0.1)' }} />
        </div>
      </div>

      {/* Terminal header */}
      <div
        className="flex items-center h-8 flex-shrink-0 px-0"
        style={{
          background: '#161B22',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {/* Terminal icon + label */}
        <div
          className="flex items-center gap-1.5 px-3 h-full border-r"
          style={{ borderColor: 'rgba(255,255,255,0.07)' }}
        >
          <TerminalIcon size={11} className="text-text-muted" />
          <span className="text-text-muted" style={{ fontSize: '0.68rem' }}>
            TERMINAL
          </span>
        </div>

        {/* Tabs */}
        {TERMINAL_TABS.map((tab) => {
          const isActive = terminal.activeTab === tab.id;
          const count = terminal.allLogs.filter((l) =>
            tab.id === 'System' ? true : l.category === tab.id.toUpperCase().replace('S', tab.id[0].toUpperCase() + tab.id.slice(1))
          ).length;

          const categoryMap: Record<TerminalTabId, TerminalLog['category'] | null> = {
            Hazards: 'HAZARD',
            Ledger: 'LEDGER',
            Swarm: 'SWARM',
            System: null,
          };

          const cat = categoryMap[tab.id];
          const filteredCount = cat
            ? terminal.allLogs.filter((l) => l.category === cat).length
            : terminal.allLogs.length;

          return (
            <button
              key={tab.id}
              onClick={() => terminal.setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-3 h-full relative transition-colors border-r"
              style={{
                borderColor: 'rgba(255,255,255,0.06)',
                background: isActive ? '#1F242D' : 'transparent',
                color: isActive ? '#E2E8F0' : '#6B7280',
              }}
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              <span style={{ color: isActive ? CATEGORY_COLORS[categoryMap[tab.id] ?? 'SYSTEM'] : 'inherit' }}>
                {tab.icon}
              </span>
              <span style={{ fontSize: '0.72rem' }}>{tab.id}</span>
              <span
                className="px-1 rounded"
                style={{
                  fontSize: '0.6rem',
                  background: 'rgba(255,255,255,0.06)',
                  color: '#6B7280',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                {filteredCount}
              </span>
              {isActive && <span className="tab-active-indicator" />}
            </button>
          );
        })}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Controls */}
        <div
          className="flex items-center gap-0 border-l h-full"
          style={{ borderColor: 'rgba(255,255,255,0.07)' }}
        >
          <button
            onClick={terminal.toggleRunning}
            className="flex items-center gap-1.5 px-3 h-full text-text-muted transition-colors"
            style={{ fontSize: '0.68rem' }}
            title={terminal.isRunning ? 'Pause' : 'Resume'}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = '')}
          >
            {terminal.isRunning ? <Pause size={11} /> : <Play size={11} />}
          </button>
          <button
            onClick={terminal.clearLogs}
            className="flex items-center gap-1.5 px-3 h-full text-text-muted transition-colors border-l"
            style={{ fontSize: '0.68rem', borderColor: 'rgba(255,255,255,0.07)' }}
            title="Clear terminal"
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = '')}
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {/* Log content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-2"
        style={{ background: '#0A0D12' }}
      >
        {terminal.logs.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span
              className="text-text-muted"
              style={{ fontSize: '0.72rem', fontFamily: 'JetBrains Mono, monospace' }}
            >
              No logs in this channel.
            </span>
          </div>
        ) : (
          <div className="flex flex-col">
            {terminal.logs.map((log, i) => (
              <LogLine key={log.id} log={log} index={i} />
            ))}
            {/* Cursor blink */}
            {terminal.isRunning && (
              <span
                className="inline-block w-2 h-3.5 ml-1 animate-pulse"
                style={{ background: '#3B82F6', verticalAlign: 'text-bottom' }}
              />
            )}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div
        className="flex items-center justify-between px-3 h-5 flex-shrink-0"
        style={{
          background: '#0D1117',
          borderTop: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div className="flex items-center gap-3">
          <span
            className="flex items-center gap-1 text-text-muted"
            style={{ fontSize: '0.62rem', fontFamily: 'JetBrains Mono, monospace' }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: terminal.isRunning ? '#10B981' : '#F59E0B' }}
            />
            {terminal.isRunning ? 'STREAMING' : 'PAUSED'}
          </span>
          <span
            className="text-text-muted"
            style={{ fontSize: '0.62rem', fontFamily: 'JetBrains Mono, monospace' }}
          >
            {terminal.allLogs.length} entries
          </span>
        </div>
        <span
          className="text-text-muted"
          style={{ fontSize: '0.62rem', fontFamily: 'JetBrains Mono, monospace' }}
        >
          vigia.log · UTF-8
        </span>
      </div>
    </div>
  );
}
