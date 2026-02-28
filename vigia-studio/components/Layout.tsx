'use client';

import { useCallback } from 'react';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { SplitView } from './SplitView';
import { Terminal } from './Terminal';
import { StatusBar } from './StatusBar';
import { useTabs } from '@/hooks/useTabs';
import { useTerminal } from '@/hooks/useTerminal';
import { useVerticalResize } from '@/hooks/useResize';
import { getCityById } from '@/lib/mockData';
import { PaneId } from '@/types';

// ─────────────────────────────────────────────
// VigiaLayout — Root application layout
// ─────────────────────────────────────────────

export function VigiaLayout() {
  const tabs = useTabs();
  const terminal = useTerminal();

  const maxTermHeight = useCallback(() => window.innerHeight * 0.55, []);
  const { height: terminalHeight, onMouseDown: onResizeStart } = useVerticalResize(
    220,
    80,
    maxTermHeight
  );

  // Route update relay
  const handleRouteUpdate = useCallback(
    (paneId: PaneId, tabId: string, partial: Partial<import('@/types').RouteState>) => {
      tabs.updateRouteState(paneId, tabId, partial);
    },
    [tabs]
  );

  // Active city for status bar
  const activeTabLeft = tabs.leftPane.tabs.find((t) => t.id === tabs.leftPane.activeTabId);
  const activeCity = activeTabLeft ? getCityById(activeTabLeft.cityId) : undefined;

  const totalOpenTabs =
    tabs.leftPane.tabs.length + (tabs.rightPane?.tabs.length ?? 0);

  return (
    <div
      className="flex flex-col w-screen overflow-hidden"
      style={{ height: '100vh', background: '#0E1117' }}
    >
      {/* ── Top Menu Bar ─────────────────────── */}
      <TopBar />

      {/* ── Main Body ────────────────────────── */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* ── Left Sidebar / Geo Explorer ──── */}
        <Sidebar
          onCityOpen={(id) => tabs.openTab(id, 'left')}
          activeCityIds={[
            ...tabs.leftPane.tabs.map((t) => t.cityId),
            ...(tabs.rightPane?.tabs.map((t) => t.cityId) ?? []),
          ]}
        />

        {/* ── Editor + Terminal Column ──────── */}
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          {/* ── Workspace (SplitView) ──────── */}
          <SplitView
            leftPane={tabs.leftPane}
            rightPane={tabs.rightPane}
            isSplit={tabs.isSplit}
            onTabClick={tabs.setActiveTab}
            onTabClose={tabs.closeTab}
            onSplitRight={tabs.splitRight}
            onCloseSplit={tabs.closeSplit}
            onRouteUpdate={handleRouteUpdate}
          />

          {/* ── Terminal Panel ─────────────── */}
          <Terminal
            terminal={terminal}
            height={terminalHeight}
            onResizeStart={onResizeStart}
          />
        </div>
      </div>

      {/* ── Bottom Status Bar ─────────────── */}
      <StatusBar
        openTabCount={totalOpenTabs}
        activeCityName={activeCity?.name}
      />
    </div>
  );
}
