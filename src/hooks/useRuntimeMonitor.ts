import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  type MonitorEntry,
  getMonitorEntries,
  clearMonitorEntries,
  subscribeMonitor,
} from '@/utils/monitorBuffer';

export type { MonitorEntry } from '@/utils/monitorBuffer';
export { pushMonitorEntry } from '@/utils/monitorBuffer';

interface ModuleHealth {
  module: string;
  totalCalls: number;
  errors: number;
  warnings: number;
  avgDurationMs: number;
  status: 'healthy' | 'degraded' | 'down';
  lastSeen: string | null;
}

function computeModuleHealth(entries: MonitorEntry[]): Map<string, ModuleHealth> {
  const map = new Map<string, ModuleHealth>();

  for (const e of entries) {
    let h = map.get(e.module);
    if (!h) {
      h = {
        module: e.module,
        totalCalls: 0,
        errors: 0,
        warnings: 0,
        avgDurationMs: 0,
        status: 'healthy',
        lastSeen: null,
      };
      map.set(e.module, h);
    }

    if (e.event === 'exit') {
      h.totalCalls++;
      if (e.status === 'failed') {
        if (e.level === 'error') h.errors++;
        else h.warnings++;
      }
      if (e.durationMs != null) {
        h.avgDurationMs = (h.avgDurationMs * (h.totalCalls - 1) + e.durationMs) / h.totalCalls;
      }
    }

    h.lastSeen = e.timestamp;

    if (h.errors > 0 && h.totalCalls > 0 && h.errors / h.totalCalls > 0.5) {
      h.status = 'down';
    } else if (h.warnings > 0) {
      h.status = 'degraded';
    } else {
      h.status = 'healthy';
    }
  }

  return map;
}

export function useRuntimeMonitor() {
  const [entries, setEntries] = useState<MonitorEntry[]>([]);
  const pollingRef = useRef<ReturnType<typeof setInterval>>();

  const moduleHealth = useMemo(() => computeModuleHealth(entries), [entries]);

  const refresh = useCallback(() => {
    setEntries(getMonitorEntries());
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeMonitor(refresh);
    refresh();
    return unsubscribe;
  }, [refresh]);

  const startPolling = useCallback((intervalMs = 5000) => {
    stopPolling();
    pollingRef.current = setInterval(refresh, intervalMs);
  }, [refresh]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = undefined;
    }
  }, []);

  const clearLogs = useCallback(() => {
    clearMonitorEntries();
    refresh();
  }, [refresh]);

  return {
    entries,
    moduleHealth,
    startPolling,
    stopPolling,
    clearLogs,
    refresh,
  };
}
