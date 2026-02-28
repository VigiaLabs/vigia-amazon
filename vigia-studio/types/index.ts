// ─────────────────────────────────────────────
// VIGIA Studio — Core Type Definitions
// ─────────────────────────────────────────────

export interface City {
  id: string;
  name: string;
  region: string;
  coordinates: [number, number]; // [lng, lat]
  zoom: number;
  population: string;
  threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface Tab {
  id: string;
  cityId: string;
  title: string;
  isDirty: boolean;
}

export interface PaneState {
  id: string;
  tabs: Tab[];
  activeTabId: string | null;
  routeState: Record<string, RouteState>; // keyed by tabId
}

export interface RouteState {
  start: string;
  destination: string;
  calculated: boolean;
  fastestETA: string;
  safestETA: string;
  fastestDistance: string;
  safestDistance: string;
  riskScore: number;
  riskLabel: string;
}

export interface TerminalLog {
  id: string;
  timestamp: string;
  category: 'HAZARD' | 'SWARM' | 'LEDGER' | 'SYSTEM';
  message: string;
  severity: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
}

export type TerminalTabId = 'Hazards' | 'Ledger' | 'Swarm' | 'System';

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  tabId: string;
  paneId: string;
}

export type PaneId = 'left' | 'right';
