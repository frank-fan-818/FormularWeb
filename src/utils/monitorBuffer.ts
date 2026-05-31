/**
 * Shared monitor buffer between logger and the runtime monitor hook.
 * logger.ts pushes entries here; useRuntimeMonitor.ts reads them.
 */

export interface MonitorEntry {
  id: number;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  module: string;
  function: string;
  event: string;
  durationMs?: number;
  status?: string;
  error?: string;
}

const MAX_ENTRIES = 500;
let nextId = 1;
const globalBuffer: MonitorEntry[] = [];
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

/** Push a monitor entry from anywhere (logger, API interceptors, etc.). */
export function pushMonitorEntry(entry: Omit<MonitorEntry, 'id'>) {
  globalBuffer.push({ ...entry, id: nextId++ });
  if (globalBuffer.length > MAX_ENTRIES) {
    globalBuffer.splice(0, globalBuffer.length - MAX_ENTRIES);
  }
  notifyListeners();
}

/** Subscribe to buffer changes. Returns unsubscribe function. */
export function subscribeMonitor(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Get a snapshot copy of the current buffer, optionally limited to the last N entries. */
export function getMonitorEntries(maxCount?: number): MonitorEntry[] {
  if (maxCount != null && maxCount < globalBuffer.length) {
    return globalBuffer.slice(-maxCount);
  }
  return [...globalBuffer];
}

/** Clear all entries. */
export function clearMonitorEntries(): void {
  globalBuffer.length = 0;
  notifyListeners();
}
