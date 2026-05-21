/**
 * Structured JSON logger with three-level format (entry → step → exit).
 * All log output is JSON-serialized for machine readability.
 * Automatically feeds the runtime monitor (monitorBuffer.ts) for observability.
 */

import type { MonitorEntry } from '@/utils/monitorBuffer';

type LogEvent = 'entry' | 'step' | 'exit';
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogPayload {
  event: LogEvent;
  module: string;
  function: string;
  timestamp?: string;
  // entry
  input?: string;
  // step
  step?: string;
  durationMs?: number;
  // exit
  status?: 'success' | 'failed';
  error?: string;
}

function formatLog(level: LogLevel, payload: LogPayload): string {
  return JSON.stringify({ level, ...payload });
}

function shouldLog(level: LogLevel): boolean {
  if (level === 'debug' && !import.meta.env.DEV && import.meta.env.MODE !== 'test') return false;
  return true;
}

// ---- Monitor feed ----
let _pushMonitorEntry: ((entry: Omit<MonitorEntry, 'id'>) => void) | null = null;
let _monitorImportStarted = false;

function toMonitorEntry(level: LogLevel, payload: LogPayload): Omit<MonitorEntry, 'id'> {
  return {
    timestamp: payload.timestamp || new Date().toISOString(),
    level: level === 'debug' ? 'info' : level,
    module: payload.module,
    function: payload.function,
    event: payload.event,
    durationMs: payload.durationMs,
    status: payload.status,
    error: payload.error,
  };
}

function feedMonitor(level: LogLevel, payload: LogPayload): void {
  // Monitor is dev-only — tree-shaken in production builds
  if (!import.meta.env.DEV) return;

  if (!_pushMonitorEntry) {
    if (!_monitorImportStarted) {
      _monitorImportStarted = true;
      import('@/utils/monitorBuffer')
        .then((mod) => {
          _pushMonitorEntry = mod.pushMonitorEntry;
          _pushMonitorEntry(toMonitorEntry(level, payload));
        })
        .catch(() => { /* monitor unavailable */ });
    }
    return;
  }
  _pushMonitorEntry(toMonitorEntry(level, payload));
}
// ----

function emit(level: LogLevel, payload: LogPayload): void {
  if (!shouldLog(level)) return;

  const message = formatLog(level, payload);
  switch (level) {
    case 'error':
      console.error(message);
      break;
    case 'warn':
      console.warn(message);
      break;
    case 'debug':
      console.debug(message);
      break;
    default:
      console.info(message);
  }

  feedMonitor(level, payload);

  // Production error reporting: send error/warn to Supabase
  const errorMsg = payload.error;
  if ((level === 'error' || level === 'warn') && errorMsg) {
    import('@/utils/errorReporter')
      .then((mod) => mod.reportError({
        module: payload.module,
        function: payload.function,
        error: errorMsg,
        level,
      }))
      .catch(() => { /* reporter unavailable */ });
  }
}

export const logger = {
  info(payload: LogPayload): void {
    emit('info', payload);
  },

  warn(payload: LogPayload): void {
    emit('warn', payload);
  },

  error(payload: LogPayload): void {
    emit('error', payload);
  },

  debug(payload: LogPayload): void {
    emit('debug', payload);
  },
};

/**
 * Convenience helper: wrap an async operation with entry/step/exit logging.
 */
export async function withLogging<T>(
  module: string,
  fnName: string,
  operation: () => Promise<T>,
  inputSummary?: string,
): Promise<T> {
  const startedAt = performance.now();

  logger.info({
    event: 'entry',
    module,
    function: fnName,
    timestamp: new Date().toISOString(),
    input: inputSummary,
  });

  try {
    const result = await operation();

    logger.info({
      event: 'step',
      module,
      function: fnName,
      step: 'complete',
      durationMs: Math.round(performance.now() - startedAt),
    });

    logger.info({
      event: 'exit',
      module,
      function: fnName,
      status: 'success',
      timestamp: new Date().toISOString(),
      durationMs: Math.round(performance.now() - startedAt),
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    logger.error({
      event: 'exit',
      module,
      function: fnName,
      status: 'failed',
      timestamp: new Date().toISOString(),
      durationMs: Math.round(performance.now() - startedAt),
      error: message,
    });

    throw error;
  }
}
