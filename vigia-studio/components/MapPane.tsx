'use client';

import dynamic from 'next/dynamic';
import { PaneState, PaneId } from '@/types';
import { RoutePanel, generateRouteData } from './RoutePanel';
import { getCityById } from '@/lib/mockData';
import { MapPin } from 'lucide-react';

// Dynamically import MapLibre to avoid SSR issues
const MapLibreMap = dynamic(
  () => import('./MapLibreMap').then((m) => ({ default: m.MapLibreMap })),
  { ssr: false }
);

interface MapPaneProps {
  pane: PaneState;
  paneId: PaneId;
  onRouteUpdate: (
    paneId: PaneId,
    tabId: string,
    partial: Partial<import('@/types').RouteState>
  ) => void;
}

// ─────────────────────────────────────────────
// EmptyPane — shown when no tabs are open
// ─────────────────────────────────────────────

function EmptyPane() {
  return (
    <div className="flex-1 flex items-center justify-center" style={{ background: '#0E1117' }}>
      <div className="flex flex-col items-center gap-4 select-none">
        {/* Geometric graphic */}
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none" opacity={0.15}>
          <rect x="2" y="2" width="24" height="24" stroke="#3B82F6" strokeWidth="1.5" />
          <rect x="30" y="2" width="24" height="24" stroke="#3B82F6" strokeWidth="1.5" />
          <rect x="2" y="30" width="24" height="24" stroke="#3B82F6" strokeWidth="1.5" />
          <rect x="30" y="30" width="24" height="24" stroke="#3B82F6" strokeWidth="1.5" />
          <line x1="14" y1="14" x2="42" y2="42" stroke="#3B82F6" strokeWidth="1" strokeDasharray="3 3" />
        </svg>

        <div className="flex flex-col items-center gap-1">
          <span className="text-text-muted" style={{ fontSize: '0.78rem' }}>
            No location open
          </span>
          <span className="text-text-muted" style={{ fontSize: '0.68rem', opacity: 0.6 }}>
            Select a city from the Geo Explorer
          </span>
        </div>

        <div className="flex flex-col gap-1 mt-2">
          {[
            ['⌘ K', 'Quick Open'],
            ['⌘ P', 'Command Palette'],
          ].map(([key, label]) => (
            <div key={key} className="flex items-center gap-3">
              <span
                className="px-1.5 py-0.5 rounded font-mono text-text-muted"
                style={{
                  fontSize: '0.65rem',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                {key}
              </span>
              <span className="text-text-muted" style={{ fontSize: '0.68rem' }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MapPane Component
// ─────────────────────────────────────────────

export function MapPane({ pane, paneId, onRouteUpdate }: MapPaneProps) {
  const activeTab = pane.tabs.find((t) => t.id === pane.activeTabId);
  const city = activeTab ? getCityById(activeTab.cityId) : null;
  const routeState = activeTab ? pane.routeState[activeTab.id] : undefined;

  if (!activeTab || !city) {
    return (
      <div className="flex flex-col flex-1 overflow-hidden" style={{ background: '#0E1117' }}>
        <EmptyPane />
      </div>
    );
  }

  const handleCalculate = (start: string, destination: string) => {
    const data = generateRouteData(start, destination);
    onRouteUpdate(paneId, activeTab.id, {
      start,
      destination,
      calculated: true,
      ...data,
    });
  };

  const handleClear = () => {
    onRouteUpdate(paneId, activeTab.id, {
      start: '',
      destination: '',
      calculated: false,
      fastestETA: '',
      safestETA: '',
      fastestDistance: '',
      safestDistance: '',
      riskScore: 0,
      riskLabel: '',
    });
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden" style={{ background: '#0E1117' }}>
      {/* Route Toolbar + Results */}
      <RoutePanel
        cityName={city.name}
        routeState={routeState}
        onCalculate={handleCalculate}
        onClear={handleClear}
      />

      {/* Map */}
      <div className="flex-1 relative overflow-hidden">
        <MapLibreMap
          coordinates={city.coordinates}
          zoom={city.zoom}
          cityName={city.name}
          routeState={routeState}
        />

        {/* City stats overlay */}
        <div
          className="absolute top-2 right-12 flex flex-col gap-1"
          style={{ pointerEvents: 'none' }}
        >
          <div
            className="flex items-center gap-2 px-2 py-1.5 rounded"
            style={{
              background: 'rgba(14,17,23,0.85)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(4px)',
            }}
          >
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <MapPin size={9} className="text-text-muted" />
                <span className="text-text-muted" style={{ fontSize: '0.62rem', fontFamily: 'JetBrains Mono, monospace' }}>
                  POP {city.population}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background:
                      city.threatLevel === 'LOW'
                        ? '#10B981'
                        : city.threatLevel === 'MEDIUM'
                        ? '#F59E0B'
                        : city.threatLevel === 'HIGH'
                        ? '#EF4444'
                        : '#DC2626',
                  }}
                />
                <span
                  className="text-text-muted"
                  style={{ fontSize: '0.62rem', fontFamily: 'JetBrains Mono, monospace' }}
                >
                  THREAT: {city.threatLevel}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
