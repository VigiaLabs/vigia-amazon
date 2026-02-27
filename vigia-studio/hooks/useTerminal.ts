import { useState, useEffect, useCallback, useRef } from 'react';
import { TerminalLog, TerminalTabId } from '@/types';
import { getNextLog, CATEGORY_COLORS } from '@/lib/mockData';

const MAX_LOGS = 300;
const LOG_INTERVAL_MS = 1800;

export interface UseTerminalReturn {
  logs: TerminalLog[];
  allLogs: TerminalLog[];
  activeTab: TerminalTabId;
  setActiveTab: (tab: TerminalTabId) => void;
  clearLogs: () => void;
  isRunning: boolean;
  toggleRunning: () => void;
}

export function useTerminal(): UseTerminalReturn {
  const [allLogs, setAllLogs] = useState<TerminalLog[]>(() => {
    // Seed with initial logs
    const seed: TerminalLog[] = [];
    for (let i = 0; i < 12; i++) {
      seed.push(getNextLog());
    }
    return seed;
  });
  const [activeTab, setActiveTab] = useState<TerminalTabId>('Hazards');
  const [isRunning, setIsRunning] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const appendLog = useCallback(() => {
    const log = getNextLog();
    setAllLogs((prev) => {
      const next = [...prev, log];
      return next.length > MAX_LOGS ? next.slice(next.length - MAX_LOGS) : next;
    });
  }, []);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(appendLog, LOG_INTERVAL_MS);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, appendLog]);

  const categoryMap: Record<TerminalTabId, TerminalLog['category']> = {
    Hazards: 'HAZARD',
    Ledger: 'LEDGER',
    Swarm: 'SWARM',
    System: 'SYSTEM',
  };

  const logs =
    activeTab === 'System'
      ? allLogs // System tab shows all
      : allLogs.filter((l) => l.category === categoryMap[activeTab]);

  const clearLogs = useCallback(() => {
    setAllLogs([]);
  }, []);

  const toggleRunning = useCallback(() => {
    setIsRunning((prev) => !prev);
  }, []);

  return {
    logs,
    allLogs,
    activeTab,
    setActiveTab,
    clearLogs,
    isRunning,
    toggleRunning,
  };
}
