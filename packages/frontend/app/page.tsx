'use client';

import { useState, useRef, useCallback } from 'react';
import { X, MapPin, Video, Terminal as TerminalIcon, Database, Radio, Server } from 'lucide-react';
import { VideoUploader }        from './components/VideoUploader';
import { LiveMap }              from './components/LiveMap';
import { LedgerTicker }         from './components/LedgerTicker';
import { ReasoningTraceViewer } from './components/ReasoningTraceViewer';
import { Sidebar }              from './components/Sidebar';
import { Breadcrumb }           from './components/Breadcrumb';
import { TopBar }               from './components/TopBar';
import { StatusBar }            from './components/StatusBar';
import { SettingsPanel }        from './components/SettingsPanel';
import { useSettings }          from './components/SettingsContext';

type MainTab    = 'map' | 'sentinel';
type ConsoleTab = 'traces' | 'ledger' | 'terminal';

export default function Dashboard() {
  const { settings } = useSettings();
  const [activeMainTab,    setActiveMainTab]    = useState<MainTab>('map');
  const [activeConsoleTab, setActiveConsoleTab] = useState<ConsoleTab>('traces');
  const [consoleHeight,    setConsoleHeight]    = useState(220);
  const [settingsOpen,     setSettingsOpen]     = useState(false);

  // ── Console resize ────────────────────────
  const isDragging  = useRef(false);
  const startY      = useRef(0);
  const startHeight = useRef(0);

  const onResizeDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current  = true;
    startY.current      = e.clientY;
    startHeight.current = consoleHeight;
    document.body.style.cursor     = 'ns-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startY.current - ev.clientY;
      setConsoleHeight(Math.max(80, Math.min(window.innerHeight * 0.55, startHeight.current + delta)));
    };
    const onUp = () => {
      isDragging.current = false;
      document.body.style.cursor = document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [consoleHeight]);

  const mainTabs = [
    { id: 'map'       as MainTab,    label: 'World Map',    icon: <MapPin size={11} /> },
    { id: 'sentinel'  as MainTab,    label: 'Sentinel Eye', icon: <Video  size={11} /> },
  ];
  const consoleTabs = [
    { id: 'traces'    as ConsoleTab, label: 'Agent Traces', icon: <Radio    size={11} /> },
    { id: 'ledger'    as ConsoleTab, label: 'DePIN Ledger', icon: <Database size={11} /> },
    { id: 'terminal'  as ConsoleTab, label: 'Terminal',     icon: <Server   size={11} /> },
  ];

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      width: '100vw', height: '100vh', overflow: 'hidden',
      background: 'var(--c-bg)',
      fontSize: `${settings.fontSize}px`,
      transition: 'background 0.2s, font-size 0.1s',
    }}>
      <TopBar onSettingsOpen={() => setSettingsOpen(true)} />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0, position: 'relative' }}>
        <Sidebar
          onSentinelEyeClick={() => setActiveMainTab('sentinel')}
          isSentinelEyeActive={activeMainTab === 'sentinel'}
          onSettingsOpen={() => setSettingsOpen(true)}
        />

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minWidth: 0 }}>

          {/* Tab bar */}
          <div style={{
            display: 'flex', alignItems: 'flex-end', height: 34, flexShrink: 0,
            background: 'var(--c-sidebar)', borderBottom: '1px solid var(--c-border)',
            overflowX: 'auto', overflowY: 'hidden',
          }}>
            {mainTabs.map((tab) => {
              const active = activeMainTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveMainTab(tab.id)} style={{
                  position: 'relative', display: 'flex', alignItems: 'center', gap: 6,
                  height: '100%', padding: '0 14px', minWidth: 110, flexShrink: 0,
                  cursor: 'pointer', border: 'none',
                  borderRight: '1px solid rgba(255,255,255,0.06)',
                  background: active ? 'var(--c-panel)' : 'transparent',
                  color: active ? 'var(--c-text)' : 'var(--c-text-3)',
                  fontSize: '0.74rem', fontWeight: active ? 500 : 400,
                  fontFamily: 'Inter, sans-serif', transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <span style={{ color: active ? 'var(--c-accent-2)' : 'var(--c-text-3)' }}>{tab.icon}</span>
                  {tab.label}
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, marginLeft: 2, color: 'var(--c-text-3)' }}>
                    <X size={10} />
                  </span>
                  {active && <span className="tab-line" />}
                </button>
              );
            })}
            <div style={{ flex: 1 }} />
          </div>

          {activeMainTab === 'map' && <Breadcrumb path={['World', 'India', 'Odisha', 'Rourkela']} />}

          <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
            {activeMainTab === 'map' && <LiveMap />}
            {activeMainTab === 'sentinel' && (
              <div style={{ height: '100%', overflowY: 'auto', padding: 24, background: 'var(--c-bg)' }}>
                <VideoUploader />
              </div>
            )}
          </div>

          {/* Console */}
          <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, height: consoleHeight, borderTop: '1px solid var(--c-border)' }}>
            <div className="drag-handle-y" onMouseDown={onResizeDown} style={{
              height: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--c-sidebar)', cursor: 'ns-resize',
            }}>
              <div className="drag-pip" style={{ width: 28, height: 2, borderRadius: 2, background: 'rgba(255,255,255,0.09)', transition: 'background 0.15s' }} />
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', height: 32, flexShrink: 0,
              background: 'var(--c-sidebar)', borderBottom: '1px solid var(--c-border)',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px',
                height: '100%', borderRight: '1px solid var(--c-border)', color: 'var(--c-text-3)',
              }}>
                <TerminalIcon size={11} />
                <span style={{ fontSize: '0.62rem', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
                  Console
                </span>
              </div>
              {consoleTabs.map((tab) => {
                const active = activeConsoleTab === tab.id;
                return (
                  <button key={tab.id} onClick={() => setActiveConsoleTab(tab.id)} style={{
                    position: 'relative', display: 'flex', alignItems: 'center', gap: 5,
                    padding: '0 13px', height: '100%', cursor: 'pointer', border: 'none',
                    borderRight: '1px solid rgba(255,255,255,0.05)',
                    background: active ? 'var(--c-panel)' : 'transparent',
                    color: active ? 'var(--c-text)' : 'var(--c-text-3)',
                    fontSize: '0.72rem', fontFamily: 'Inter, sans-serif', transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                  onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <span style={{ color: active ? 'var(--c-accent-2)' : 'var(--c-text-3)' }}>{tab.icon}</span>
                    {tab.label}
                    {active && <span className="tab-line" />}
                  </button>
                );
              })}
              <div style={{ flex: 1 }} />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', background: 'var(--c-deep)' }}>
              {activeConsoleTab === 'traces'   && <ReasoningTraceViewer />}
              {activeConsoleTab === 'ledger'   && <LedgerTicker />}
              {activeConsoleTab === 'terminal' && (
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem' }}>
                  {[
                    { text: 'System initialized',            color: 'var(--c-text-2)' },
                    { text: 'Ready for telemetry ingestion', color: 'var(--c-text-2)' },
                    { text: 'ONNX Runtime: Loaded',          color: 'var(--c-green)'  },
                    { text: 'Bedrock Agent: Connected',      color: 'var(--c-green)'  },
                    { text: 'DynamoDB: Polling active',      color: 'var(--c-green)'  },
                    { text: 'Edge swarm: 48 nodes online',   color: 'var(--c-accent-2)' },
                    { text: 'Ledger integrity: ✓ verified',  color: 'var(--c-green)'  },
                  ].map(({ text, color }, i) => (
                    <div key={i} className="log-line" style={{ display: 'flex', gap: 8, marginBottom: 3 }}>
                      <span style={{ color: 'var(--c-elevated)' }}>›</span>
                      <span style={{ color }}>{text}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                    <span style={{ color: 'var(--c-elevated)' }}>›</span>
                    <span style={{ display: 'inline-block', width: 7, height: 13, background: 'var(--c-accent)', animation: 'status-pulse 1s ease-in-out infinite', verticalAlign: 'text-bottom' }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      </div>

      <StatusBar />
    </div>
  );
}
