import type {
  DiagnosticBaseContext,
  DiagnosticEvent,
  DiagnosticReasonCode,
} from '@/types/diagnostics';
import type { DiagnosticLogDetails, LogPayload } from '@/utils/logger';

const STORAGE_KEY = 'f1-diagnostic-trace-v1';
const MAX_TRACE_EVENTS = 100;

export interface DiagnosticStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function createFlowId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `flow-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function classifyDiagnosticError(error: unknown): DiagnosticReasonCode {
  const candidate = error as { name?: string; message?: string; status?: number; code?: string } | null;
  const name = candidate?.name?.toLowerCase() || '';
  const message = candidate?.message?.toLowerCase() || String(error).toLowerCase();
  const status = candidate?.status;
  if (name === 'aborterror') return 'unknown';
  if (/timeout|timed out/.test(message)) return 'timeout';
  if (/failed to fetch|network|offline|econn/.test(message)) return 'network';
  if (candidate?.code === '42P01' || /schema cache|relation .* does not exist/.test(message)) {
    return 'schema_unavailable';
  }
  if (/validation|invalid|parse|schema/.test(message)) return 'validation';
  if (/identity .* match|identity mismatch/.test(message)) return 'identity_mismatch';
  if (status === 404 || /not found|\b404\b/.test(message)) return 'not_found';
  if (status !== undefined && status >= 500) return 'http_5xx';
  if (status !== undefined && status >= 400) return 'http_4xx';
  return 'unknown';
}

function safeLabel(value: string | undefined, maxLength = 96): string | undefined {
  if (!value) return undefined;
  const normalized = value.replace(/[^A-Za-z0-9_.:-]+/g, '_').slice(0, maxLength);
  return normalized || undefined;
}

export function sanitizeDiagnosticEvent(event: DiagnosticEvent): DiagnosticEvent {
  return {
    flowId: safeLabel(event.flowId, 64) || 'unknown',
    feature: 'race_detail',
    season: safeLabel(event.season, 8) || 'unknown',
    round: safeLabel(event.round, 8) || 'unknown',
    section: safeLabel(event.section, 32),
    session: safeLabel(event.session, 8),
    timestamp: event.timestamp,
    operation: safeLabel(event.operation, 96) || 'unknown',
    outcome: event.outcome,
    source: event.source,
    reasonCode: event.reasonCode,
    durationMs: Number.isFinite(event.durationMs) ? Math.max(0, Math.round(event.durationMs!)) : undefined,
    itemCount: Number.isFinite(event.itemCount) ? Math.max(0, Math.round(event.itemCount!)) : undefined,
    attempt: Number.isFinite(event.attempt) ? Math.max(0, Math.round(event.attempt!)) : undefined,
  };
}

function browserStorage(): DiagnosticStorage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

export function appendDiagnosticEvent(
  event: DiagnosticEvent,
  storage: DiagnosticStorage | null = browserStorage(),
): void {
  if (!storage) return;
  try {
    const current = JSON.parse(storage.getItem(STORAGE_KEY) || '[]') as unknown;
    const events = Array.isArray(current) ? current : [];
    events.push(sanitizeDiagnosticEvent(event));
    storage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_TRACE_EVENTS)));
  } catch {
    // Diagnostics must never become a user-visible failure.
  }
}

export function buildDiagnosticLog(
  context: DiagnosticBaseContext,
  details: DiagnosticLogDetails,
): { level: 'info' | 'warn' | 'error'; payload: LogPayload } {
  const event: DiagnosticEvent = {
    ...context,
    session: details.session ?? context.session,
    timestamp: new Date().toISOString(),
    operation: details.operation,
    outcome: details.outcome,
    source: details.source,
    reasonCode: details.reasonCode
      ?? (details.error === undefined ? undefined : classifyDiagnosticError(details.error)),
    durationMs: details.durationMs,
    itemCount: details.itemCount,
    attempt: details.attempt,
  };
  appendDiagnosticEvent(event);

  return {
    level: details.outcome === 'failed'
      ? 'error'
      : details.outcome === 'degraded' ? 'warn' : 'info',
    payload: {
      event: details.outcome === 'started' ? 'entry' : 'step',
      module: context.feature,
      function: details.operation,
      status: details.outcome === 'failed' ? 'failed' : undefined,
      error: details.error === undefined
        ? undefined
        : details.error instanceof Error ? details.error.message : String(details.error),
      ...event,
    },
  };
}

export function getDiagnosticTrace(
  flowId?: string,
  storage: DiagnosticStorage | null = browserStorage(),
): DiagnosticEvent[] {
  if (!storage) return [];
  try {
    const current = JSON.parse(storage.getItem(STORAGE_KEY) || '[]') as unknown;
    if (!Array.isArray(current)) return [];
    const events = current as DiagnosticEvent[];
    return flowId ? events.filter((event) => event.flowId === flowId) : events;
  } catch {
    return [];
  }
}

export function getLatestDiagnosticContext(): DiagnosticBaseContext | null {
  const events = getDiagnosticTrace();
  const event = events[events.length - 1];
  if (!event) return null;
  return {
    flowId: event.flowId,
    feature: 'race_detail',
    season: event.season,
    round: event.round,
    section: event.section,
    session: event.session,
  };
}

export function createDiagnosticBase(
  season: string,
  round: string,
  section?: string,
): DiagnosticBaseContext {
  return { flowId: createFlowId(), feature: 'race_detail', season, round, section };
}
