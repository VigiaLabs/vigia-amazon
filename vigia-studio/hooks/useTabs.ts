import { useState, useCallback } from 'react';
import { Tab, PaneState } from '@/types';
import { getCityById } from '@/lib/mockData';

// ─────────────────────────────────────────────
// useTabs — Tab lifecycle management per pane
// ─────────────────────────────────────────────

function createTab(cityId: string): Tab {
  const city = getCityById(cityId);
  return {
    id: `tab-${cityId}-${Date.now()}`,
    cityId,
    title: city?.name ?? cityId,
    isDirty: false,
  };
}

function createPaneState(id: string): PaneState {
  return {
    id,
    tabs: [],
    activeTabId: null,
    routeState: {},
  };
}

export interface UseTabsReturn {
  leftPane: PaneState;
  rightPane: PaneState | null;
  isSplit: boolean;
  openTab: (cityId: string, paneId: 'left' | 'right') => void;
  closeTab: (tabId: string, paneId: 'left' | 'right') => void;
  setActiveTab: (tabId: string, paneId: 'left' | 'right') => void;
  splitRight: (tabId: string) => void;
  closeSplit: () => void;
  updateRouteState: (
    paneId: 'left' | 'right',
    tabId: string,
    partial: Partial<import('@/types').RouteState>
  ) => void;
}

export function useTabs(): UseTabsReturn {
  const [leftPane, setLeftPane] = useState<PaneState>(createPaneState('left'));
  const [rightPane, setRightPane] = useState<PaneState | null>(null);

  const updatePane = useCallback(
    (paneId: 'left' | 'right', updater: (p: PaneState) => PaneState) => {
      if (paneId === 'left') setLeftPane(updater);
      else setRightPane((prev) => (prev ? updater(prev) : prev));
    },
    []
  );

  const openTab = useCallback(
    (cityId: string, paneId: 'left' | 'right') => {
      updatePane(paneId, (pane) => {
        // Check if city already has an open tab
        const existing = pane.tabs.find((t) => t.cityId === cityId);
        if (existing) {
          return { ...pane, activeTabId: existing.id };
        }
        const newTab = createTab(cityId);
        return {
          ...pane,
          tabs: [...pane.tabs, newTab],
          activeTabId: newTab.id,
        };
      });
    },
    [updatePane]
  );

  const closeTab = useCallback(
    (tabId: string, paneId: 'left' | 'right') => {
      updatePane(paneId, (pane) => {
        const idx = pane.tabs.findIndex((t) => t.id === tabId);
        if (idx === -1) return pane;
        const newTabs = pane.tabs.filter((t) => t.id !== tabId);
        const newRouteState = { ...pane.routeState };
        delete newRouteState[tabId];

        let newActiveId: string | null = pane.activeTabId;
        if (pane.activeTabId === tabId) {
          if (newTabs.length === 0) {
            newActiveId = null;
          } else {
            const nextIdx = Math.min(idx, newTabs.length - 1);
            newActiveId = newTabs[nextIdx].id;
          }
        }
        return { ...pane, tabs: newTabs, activeTabId: newActiveId, routeState: newRouteState };
      });
    },
    [updatePane]
  );

  const setActiveTab = useCallback(
    (tabId: string, paneId: 'left' | 'right') => {
      updatePane(paneId, (pane) => ({ ...pane, activeTabId: tabId }));
    },
    [updatePane]
  );

  const splitRight = useCallback(
    (tabId: string) => {
      const sourceTab = leftPane.tabs.find((t) => t.id === tabId);
      if (!sourceTab) return;

      const newTab = createTab(sourceTab.cityId);
      setRightPane({
        id: 'right',
        tabs: [newTab],
        activeTabId: newTab.id,
        routeState: {},
      });
    },
    [leftPane.tabs]
  );

  const closeSplit = useCallback(() => {
    setRightPane(null);
  }, []);

  const updateRouteState = useCallback(
    (
      paneId: 'left' | 'right',
      tabId: string,
      partial: Partial<import('@/types').RouteState>
    ) => {
      updatePane(paneId, (pane) => ({
        ...pane,
        routeState: {
          ...pane.routeState,
          [tabId]: {
            start: '',
            destination: '',
            calculated: false,
            fastestETA: '',
            safestETA: '',
            fastestDistance: '',
            safestDistance: '',
            riskScore: 0,
            riskLabel: '',
            ...(pane.routeState[tabId] ?? {}),
            ...partial,
          },
        },
      }));
    },
    [updatePane]
  );

  return {
    leftPane,
    rightPane,
    isSplit: rightPane !== null,
    openTab,
    closeTab,
    setActiveTab,
    splitRight,
    closeSplit,
    updateRouteState,
  };
}
