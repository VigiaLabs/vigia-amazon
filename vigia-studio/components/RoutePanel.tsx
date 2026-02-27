'use client';

import { useState } from 'react';
import {
  Navigation,
  Clock,
  Shield,
  AlertTriangle,
  ChevronRight,
  Zap,
  RotateCcw,
  MapPin,
} from 'lucide-react';
import { RouteState } from '@/types';

interface RoutePanelProps {
  cityName: string;
  routeState: RouteState | undefined;
  onCalculate: (start: string, destination: string) => void;
  onClear: () => void;
}

// ─────────────────────────────────────────────
// Mock route data generator
// ─────────────────────────────────────────────

function generateRouteData(start: string, destination: string): Omit<RouteState, 'start' | 'destination' | 'calculated'> {
  const fastestMins = Math.floor(Math.random() * 25) + 8;
  const safestMins = fastestMins + Math.floor(Math.random() * 12) + 3;
  const riskScore = parseFloat((Math.random() * 0.6 + 0.1).toFixed(2));
  const riskLabel = riskScore < 0.3 ? 'LOW' : riskScore < 0.6 ? 'MEDIUM' : 'HIGH';
  const distFastest = (Math.random() * 8 + 2).toFixed(1);
  const distSafest = (parseFloat(distFastest) + Math.random() * 2).toFixed(1);

  return {
    fastestETA: `${fastestMins} min`,
    safestETA: `${safestMins} min`,
    fastestDistance: `${distFastest} mi`,
    safestDistance: `${distSafest} mi`,
    riskScore,
    riskLabel,
  };
}

// ─────────────────────────────────────────────
// RiskBadge
// ─────────────────────────────────────────────

function RiskBadge({ score, label }: { score: number; label: string }) {
  const color =
    label === 'LOW' ? '#10B981' : label === 'MEDIUM' ? '#F59E0B' : '#EF4444';
  const bg =
    label === 'LOW'
      ? 'rgba(16,185,129,0.12)'
      : label === 'MEDIUM'
      ? 'rgba(245,158,11,0.12)'
      : 'rgba(239,68,68,0.12)';

  const barWidth = Math.round(score * 100);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-text-muted" style={{ fontSize: '0.68rem' }}>
          Risk Score
        </span>
        <span
          className="flex items-center gap-1 px-1.5 py-0.5 rounded"
          style={{ background: bg, color, fontSize: '0.64rem', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}
        >
          <AlertTriangle size={8} />
          {label} · {score.toFixed(2)}
        </span>
      </div>
      <div
        className="h-1 w-full rounded"
        style={{ background: 'rgba(255,255,255,0.06)' }}
      >
        <div
          className="h-full rounded transition-all duration-700"
          style={{ width: `${barWidth}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// RouteCard
// ─────────────────────────────────────────────

interface RouteCardProps {
  type: 'fastest' | 'safest';
  eta: string;
  distance: string;
}

function RouteCard({ type, eta, distance }: RouteCardProps) {
  const isFastest = type === 'fastest';
  const color = isFastest ? '#3B82F6' : '#10B981';
  const bg = isFastest ? 'rgba(59,130,246,0.06)' : 'rgba(16,185,129,0.06)';
  const border = isFastest ? 'rgba(59,130,246,0.2)' : 'rgba(16,185,129,0.2)';

  return (
    <div
      className="flex-1 rounded p-2.5 flex flex-col gap-1.5"
      style={{ background: bg, border: `1px solid ${border}` }}
    >
      <div className="flex items-center gap-1.5">
        {isFastest ? (
          <Zap size={11} style={{ color }} />
        ) : (
          <Shield size={11} style={{ color }} />
        )}
        <span style={{ fontSize: '0.68rem', color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {isFastest ? 'Fastest' : 'Safest'}
        </span>
      </div>
      <div className="flex items-end gap-1">
        <span style={{ fontSize: '1.25rem', fontWeight: 600, color: '#E2E8F0', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 }}>
          {eta}
        </span>
      </div>
      <span style={{ fontSize: '0.66rem', color: '#6B7280' }}>
        {distance}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// RoutePanel Component
// ─────────────────────────────────────────────

export function RoutePanel({ cityName, routeState, onCalculate, onClear }: RoutePanelProps) {
  const [start, setStart] = useState(routeState?.start ?? '');
  const [destination, setDestination] = useState(routeState?.destination ?? '');
  const [isCalculating, setIsCalculating] = useState(false);

  const handleCalculate = async () => {
    if (!start.trim() || !destination.trim()) return;
    setIsCalculating(true);
    // Simulate async calculation
    await new Promise((r) => setTimeout(r, 900));
    setIsCalculating(false);
    onCalculate(start, destination);
  };

  const handleClear = () => {
    setStart('');
    setDestination('');
    onClear();
  };

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 3,
    color: '#E2E8F0',
    fontSize: '0.75rem',
    padding: '5px 8px',
    width: '100%',
    outline: 'none',
    fontFamily: 'Inter, system-ui, sans-serif',
  };

  return (
    <div
      className="flex flex-col gap-0 flex-shrink-0"
      style={{
        background: '#1A1F28',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Toolbar row */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        {/* City label */}
        <div className="flex items-center gap-1.5 mr-1">
          <MapPin size={11} className="text-accent-blue-bright" />
          <span
            className="text-text-secondary font-mono"
            style={{ fontSize: '0.68rem', fontFamily: 'JetBrains Mono, monospace' }}
          >
            {cityName.toUpperCase()}
          </span>
        </div>

        <div className="w-px h-4 mx-1" style={{ background: 'rgba(255,255,255,0.08)' }} />

        {/* Start */}
        <div className="flex items-center gap-1.5 flex-1 max-w-[180px]">
          <span className="text-text-muted flex-shrink-0" style={{ fontSize: '0.65rem' }}>
            FROM
          </span>
          <input
            type="text"
            placeholder="Origin..."
            value={start}
            onChange={(e) => setStart(e.target.value)}
            style={inputStyle}
            className="vigia-input flex-1"
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)';
            }}
          />
        </div>

        <ChevronRight size={12} className="text-text-muted flex-shrink-0" />

        {/* Destination */}
        <div className="flex items-center gap-1.5 flex-1 max-w-[180px]">
          <span className="text-text-muted flex-shrink-0" style={{ fontSize: '0.65rem' }}>
            TO
          </span>
          <input
            type="text"
            placeholder="Destination..."
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            style={inputStyle}
            className="vigia-input flex-1"
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)';
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCalculate();
            }}
          />
        </div>

        {/* Actions */}
        <button
          onClick={handleCalculate}
          disabled={isCalculating || !start.trim() || !destination.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded transition-all flex-shrink-0"
          style={{
            background: isCalculating ? 'rgba(37,99,235,0.5)' : '#2563EB',
            color: '#fff',
            fontSize: '0.72rem',
            fontWeight: 500,
            opacity: !start.trim() || !destination.trim() ? 0.5 : 1,
            cursor: !start.trim() || !destination.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {isCalculating ? (
            <>
              <div
                className="w-3 h-3 border border-white rounded-full animate-spin"
                style={{ borderTopColor: 'transparent' }}
              />
              Calculating...
            </>
          ) : (
            <>
              <Navigation size={11} />
              Calculate Route
            </>
          )}
        </button>

        {routeState?.calculated && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1 px-2 py-1.5 rounded transition-all flex-shrink-0"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#6B7280',
              fontSize: '0.72rem',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
              (e.currentTarget as HTMLElement).style.color = '#E2E8F0';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
              (e.currentTarget as HTMLElement).style.color = '#6B7280';
            }}
          >
            <RotateCcw size={10} />
            Clear
          </button>
        )}
      </div>

      {/* Results row */}
      {routeState?.calculated && (
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="flex gap-2 flex-shrink-0">
            <RouteCard type="fastest" eta={routeState.fastestETA} distance={routeState.fastestDistance} />
            <RouteCard type="safest" eta={routeState.safestETA} distance={routeState.safestDistance} />
          </div>

          <div className="w-px self-stretch" style={{ background: 'rgba(255,255,255,0.07)' }} />

          <div className="flex-1 max-w-xs">
            <RiskBadge score={routeState.riskScore} label={routeState.riskLabel} />
          </div>

          <div className="w-px self-stretch" style={{ background: 'rgba(255,255,255,0.07)' }} />

          {/* Route meta */}
          <div className="flex flex-col gap-1 text-text-muted" style={{ fontSize: '0.65rem' }}>
            <span>
              <span className="text-text-muted">From:</span>{' '}
              <span className="text-text-secondary">{routeState.start}</span>
            </span>
            <span>
              <span className="text-text-muted">To:</span>{' '}
              <span className="text-text-secondary">{routeState.destination}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export { generateRouteData };
