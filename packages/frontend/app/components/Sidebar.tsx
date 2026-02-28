'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Globe, Layers, Radio, Database,
  Settings, GitBranch, Search, AlertTriangle,
  Navigation, ChevronRight, ChevronDown,
  Folder, FolderOpen, FileText, Video,
  Clock, MapPin, Activity,
} from 'lucide-react';

interface SidebarProps {
  onSentinelEyeClick:  () => void;
  isSentinelEyeActive: boolean;
  onSettingsOpen:      () => void;
}

// ─────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────

const C = {
  bg:      '#141920',
  actBar:  '#0C1016',
  border:  'rgba(255,255,255,0.07)',
  text:    '#DDE3ED',
  textSec: '#7C8799',
  textMut: '#3D4655',
  accent:  '#3B82F6',
  accentBg:'rgba(59,130,246,0.12)',
  hover:   'rgba(255,255,255,0.04)',
  green:   '#0EA472',
  red:     '#E5484D',
  yellow:  '#E9A23B',
};

// ─────────────────────────────────────────────
// Activity bar icon
// ─────────────────────────────────────────────

function ActivityBtn({ icon, active, label, onClick }: {
  icon: React.ReactNode;
  active?: boolean;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      style={{
        width: '100%',
        height: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        background: 'transparent',
        color: active ? C.text : C.textMut,
        borderLeft: active ? `2px solid ${C.accent}` : '2px solid transparent',
        cursor: 'pointer',
        transition: 'color 0.12s, background 0.12s',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.color = C.textSec;
          (e.currentTarget as HTMLElement).style.background = C.hover;
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.color = C.textMut;
          (e.currentTarget as HTMLElement).style.background = 'transparent';
        }
      }}
    >
      {icon}
    </button>
  );
}

// ─────────────────────────────────────────────
// Tree node
// ─────────────────────────────────────────────

function TreeNode({
  label, icon, depth = 0, isActive = false,
  onClick, children, badge, badgeColor,
}: {
  label: string;
  icon: 'folder' | 'file' | 'video' | 'session';
  depth?: number;
  isActive?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
  badge?: string;
  badgeColor?: string;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasChildren = Boolean(children);

  const handleClick = () => {
    if (hasChildren) setExpanded(v => !v);
    onClick?.();
  };

  const iconEl = () => {
    if (icon === 'video')   return <Video    size={11} style={{ color: C.accent,   flexShrink: 0 }} />;
    if (icon === 'file')    return <FileText  size={11} style={{ color: C.textMut,  flexShrink: 0 }} />;
    if (icon === 'session') return <Clock     size={11} style={{ color: C.textMut,  flexShrink: 0 }} />;
    if (expanded)           return <FolderOpen size={11} style={{ color: C.textSec, flexShrink: 0 }} />;
    return                         <Folder    size={11} style={{ color: C.textMut,  flexShrink: 0 }} />;
  };

  return (
    <div>
      <button
        onClick={handleClick}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          height: 26,
          paddingLeft: 8 + depth * 12,
          paddingRight: 8,
          border: 'none',
          background: isActive ? C.accentBg : 'transparent',
          cursor: 'pointer',
          position: 'relative',
          transition: 'background 0.1s',
        }}
        onMouseEnter={(e) => {
          if (!isActive) (e.currentTarget as HTMLElement).style.background = C.hover;
        }}
        onMouseLeave={(e) => {
          if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
        }}
      >
        {isActive && (
          <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: C.accent }} />
        )}

        {/* Chevron */}
        <span style={{ width: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {hasChildren
            ? (expanded
              ? <ChevronDown  size={9}  style={{ color: C.textMut }} />
              : <ChevronRight size={9}  style={{ color: C.textMut }} />)
            : null}
        </span>

        {iconEl()}

        <span style={{
          flex: 1,
          fontSize: '0.74rem',
          color: isActive ? C.text : icon === 'video' ? C.textSec : '#5C6B80',
          fontWeight: isActive ? 500 : 400,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textAlign: 'left',
          fontFamily: 'Inter, sans-serif',
        }}>
          {label}
        </span>

        {badge && (
          <span style={{
            fontSize: '0.58rem',
            padding: '1px 5px',
            borderRadius: 3,
            background: badgeColor ? `${badgeColor}22` : 'rgba(255,255,255,0.06)',
            color: badgeColor ?? C.textMut,
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 600,
            flexShrink: 0,
          }}>
            {badge}
          </span>
        )}

        {icon === 'video' && (
          <span style={{
            fontSize: '0.52rem', padding: '1px 4px', borderRadius: 2,
            background: '#E5484D', color: '#fff', fontWeight: 700,
            letterSpacing: '0.06em', fontFamily: 'Inter, sans-serif',
            flexShrink: 0,
          }}>
            LIVE
          </span>
        )}
      </button>
      {hasChildren && expanded && <div>{children}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────
// Quick-stat chip
// ─────────────────────────────────────────────

function StatChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 2,
      padding: '6px 0',
      flex: 1,
    }}>
      <span style={{ fontSize: '0.78rem', fontWeight: 600, color, fontFamily: 'JetBrains Mono, monospace' }}>
        {value}
      </span>
      <span style={{ fontSize: '0.58rem', color: C.textMut, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'Inter, sans-serif' }}>
        {label}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sidebar Component
// ─────────────────────────────────────────────

const MIN_WIDTH = 160;
const MAX_WIDTH = 340;
const DEFAULT_WIDTH = 210;

export function Sidebar({ onSentinelEyeClick, isSentinelEyeActive, onSettingsOpen }: SidebarProps) {
  const [width, setWidth]         = useState(DEFAULT_WIDTH);
  const [isDragging, setIsDragging] = useState(false);
  const [filterText, setFilterText] = useState('');
  const startX   = useRef(0);
  const startW   = useRef(DEFAULT_WIDTH);
  const handleRef = useRef<HTMLDivElement>(null);

  // ── Drag resize ───────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startX.current = e.clientX;
    startW.current = width;
    setIsDragging(true);
    document.body.style.cursor     = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [width]);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - startX.current;
      setWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startW.current + delta)));
    };
    const onUp = () => {
      setIsDragging(false);
      document.body.style.cursor     = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [isDragging]);

  const isCollapsed = width <= MIN_WIDTH + 10;

  return (
    <div style={{ display: 'flex', flexShrink: 0, height: '100%', position: 'relative' }}>

      {/* ── Activity Bar ────────────────────── */}
      <div style={{
        width: 40,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        background: C.actBar,
        borderRight: `1px solid ${C.border}`,
      }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <ActivityBtn icon={<Globe size={17} />}    active label="Geo Explorer" />
          <ActivityBtn icon={<Layers size={17} />}   label="Layers" />
          <ActivityBtn icon={<Radio size={17} />}    label="Swarm" />
          <ActivityBtn icon={<Database size={17} />} label="Ledger" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <ActivityBtn icon={<GitBranch size={17} />} label="Source Control" />
          <ActivityBtn icon={<Settings size={17} />}  label="Settings" onClick={onSettingsOpen} />
        </div>
      </div>

      {/* ── Explorer Panel ──────────────────── */}
      <div style={{
        width,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: C.bg,
        transition: isDragging ? 'none' : undefined,
      }}>
        {/* Panel header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 10px',
          height: 32,
          flexShrink: 0,
          borderBottom: `1px solid ${C.border}`,
        }}>
          <span style={{
            fontSize: '0.62rem',
            color: C.textMut,
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            fontFamily: 'Inter, sans-serif',
          }}>
            {isCollapsed ? '≡' : 'EXPLORER'}
          </span>
          {!isCollapsed && (
            <button style={{ background: 'none', border: 'none', color: C.textMut, cursor: 'pointer', display: 'flex', padding: 2 }}
              onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = C.textSec}
              onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = C.textMut}
            >
              <Search size={12} />
            </button>
          )}
        </div>

        {/* Search filter */}
        {!isCollapsed && (
          <div style={{ padding: '6px 8px', borderBottom: `1px solid rgba(255,255,255,0.05)`, flexShrink: 0 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              height: 24, padding: '0 8px', borderRadius: 3,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}>
              <Search size={10} style={{ color: C.textMut, flexShrink: 0 }} />
              <input
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filter..."
                style={{
                  background: 'transparent', border: 'none', outline: 'none',
                  fontSize: '0.7rem', color: C.textSec,
                  fontFamily: 'Inter, sans-serif', flex: 1, width: 0,
                }}
              />
            </div>
          </div>
        )}

        {/* ── Stats strip ───────────────────── */}
        {!isCollapsed && (
          <div style={{
            display: 'flex',
            borderBottom: `1px solid ${C.border}`,
            flexShrink: 0,
          }}>
            <StatChip label="Hazards" value="7"  color={C.red}    />
            <div style={{ width: 1, background: C.border, margin: '6px 0' }} />
            <StatChip label="Verified" value="6" color={C.accent} />
            <div style={{ width: 1, background: C.border, margin: '6px 0' }} />
            <StatChip label="Nodes"  value="48"  color={C.green}  />
          </div>
        )}

        {/* Tree */}
        <div style={{ flex: 1, overflowY: 'auto', paddingTop: 4, paddingBottom: 4 }}>
          <TreeNode label="Sessions" icon="folder">
            <TreeNode label="2026-02-28" icon="folder" depth={1}>
              <TreeNode label="Session-001" icon="session" depth={2} badge="3 hz" badgeColor={C.red} />
              <TreeNode label="Session-002" icon="session" depth={2} badge="1 hz" badgeColor={C.yellow} />
            </TreeNode>
          </TreeNode>

          <TreeNode label="Live Streams" icon="folder">
            <TreeNode
              label="Sentinel Eye"
              icon="video"
              depth={1}
              isActive={isSentinelEyeActive}
              onClick={onSentinelEyeClick}
            />
          </TreeNode>

          {/* Divider */}
          {!isCollapsed && (
            <>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '6px 8px' }} />
              <div style={{ padding: '2px 10px 4px', fontSize: '0.6rem', color: C.textMut, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
                Pinned
              </div>

              {[
                { icon: <Navigation size={10} />, label: 'Route Library',  badge: undefined },
                { icon: <AlertTriangle size={10} style={{ color: C.red }} />, label: 'Active Hazards', badge: '7' },
                { icon: <Activity size={10} />,   label: 'Swarm Monitor',  badge: '48' },
                { icon: <MapPin size={10} />,      label: 'Rourkela Zone',  badge: undefined },
              ].map(({ icon, label, badge }) => (
                <button
                  key={label}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 10px 5px 20px', border: 'none',
                    background: 'transparent', cursor: 'pointer', transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = C.hover}
                  onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <span style={{ color: C.textMut, flexShrink: 0 }}>{icon}</span>
                  <span style={{ fontSize: '0.73rem', color: '#5C6B80', flex: 1, textAlign: 'left', fontFamily: 'Inter, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {label}
                  </span>
                  {badge && (
                    <span style={{
                      fontSize: '0.58rem', padding: '1px 5px', borderRadius: 3,
                      background: 'rgba(255,255,255,0.06)', color: C.textMut,
                      fontFamily: 'JetBrains Mono, monospace',
                    }}>
                      {badge}
                    </span>
                  )}
                </button>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        {!isCollapsed && (
          <div style={{
            padding: '7px 10px',
            borderTop: `1px solid ${C.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, flexShrink: 0 }} className="pulse" />
            <span style={{ fontSize: '0.64rem', color: C.textMut, fontFamily: 'Inter, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Rourkela · India · Online
            </span>
          </div>
        )}
      </div>

      {/* ── Drag resize handle ───────────────── */}
      <div
        ref={handleRef}
        className={`drag-handle-x ${isDragging ? 'dragging' : ''}`}
        onMouseDown={onMouseDown}
        style={{
          width: 4,
          background: 'transparent',
          cursor: 'col-resize',
          flexShrink: 0,
          borderRight: `1px solid ${C.border}`,
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.3)'}
        onMouseLeave={(e) => { if (!isDragging) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      />
    </div>
  );
}
