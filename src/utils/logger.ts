/**
 * Structured JSON logger with three-level format (entry → step → exit).
 * All log output is JSON-serialized for machine readability.
 */

import type {
  DiagnosticBaseContext,
  DiagnosticOutcome,
  DiagnosticReasonCode,
  DiagnosticSource,
} from '@/types/diagnostics';
import { appendDiagnosticEvent, classifyDiagnosticError } from '@/utils/diagnostics';

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type LogEvent = 'entry' | 'step' | 'exit';
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogPayload {
  event: LogEvent;
  module: string;
  function: string;
  timestamp?: string;
  input?: string;
  step?: string;
  durationMs?: number;
  status?: 'success' | 'failed';
  error?: string;
  flowId?: string;
  feature?: 'race_detail';
  season?: string;
  round?: string;
  section?: string;
  session?: string;
  operation?: string;
  outcome?: DiagnosticOutcome;
  source?: DiagnosticSource;
  reasonCode?: DiagnosticReasonCode;
  itemCount?: number;
  attempt?: number;
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
        flowId: payload.flowId,
        feature: payload.feature,
        season: payload.season,
        round: payload.round,
        section: payload.section,
        session: payload.session,
        operation: payload.operation,
        outcome: payload.outcome,
        source: payload.source,
        reasonCode: payload.reasonCode,
        durationMs: payload.durationMs,
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

export interface DiagnosticLogDetails {
  operation: string;
  outcome: DiagnosticOutcome;
  source?: DiagnosticSource;
  reasonCode?: DiagnosticReasonCode;
  durationMs?: number;
  itemCount?: number;
  attempt?: number;
  error?: unknown;
  session?: string;
}

export interface DiagnosticLoggerScope {
  readonly context: DiagnosticBaseContext;
  log(details: DiagnosticLogDetails): void;
}

export function createLoggerScope(context: DiagnosticBaseContext): DiagnosticLoggerScope {
  const immutableContext = Object.freeze({ ...context });
  return {
    context: immutableContext,
    log(details) {
      const reasonCode = details.reasonCode
        ?? (details.error === undefined ? undefined : classifyDiagnosticError(details.error));
      const event = {
        ...immutableContext,
        session: details.session ?? immutableContext.session,
        timestamp: new Date().toISOString(),
        operation: details.operation,
        outcome: details.outcome,
        source: details.source,
        reasonCode,
        durationMs: details.durationMs,
        itemCount: details.itemCount,
        attempt: details.attempt,
      };
      appendDiagnosticEvent(event);
      const payload: LogPayload = {
        event: details.outcome === 'started' ? 'entry' : 'step',
        module: immutableContext.feature,
        function: details.operation,
        status: details.outcome === 'failed' ? 'failed' : undefined,
        error: details.error === undefined ? undefined : getErrorMessage(details.error),
        ...event,
      };
      if (details.outcome === 'failed') logger.error(payload);
      else if (details.outcome === 'degraded') logger.warn(payload);
      else logger.info(payload);
    },
  };
}

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
