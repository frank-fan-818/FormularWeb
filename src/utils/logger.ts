/**
 * Structured JSON logger with three-level format (entry → step → exit).
 * All log output is JSON-serialized for machine readability.
 */

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type LogEvent = 'entry' | 'step' | 'exit';
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogPayload {
  event: LogEvent;
  module: string;
  function: string;
  timestamp?: string;
  input?: string;
  step?: string;
  durationMs?: number;
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
    const message = getErrorMessage(error);

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
