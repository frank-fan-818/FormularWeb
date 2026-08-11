/**
 * Production error reporter — sends logger.error() calls to Supabase.
 * Dev-only: monitor page. Production: errors go to Supabase error_logs table.
 *
 * Fire-and-forget: does not block the caller, silently fails if unreachable.
 */
const ERROR_LOGS_TABLE = 'error_logs';
export type ErrorReportPayload = {
  module: string;
  function: string;
  error: string;
  level?: 'error' | 'warn';
  flowId?: string;
  feature?: string;
  season?: string;
  round?: string;
  section?: string;
  session?: string;
  operation?: string;
  outcome?: string;
  source?: string;
  reasonCode?: string;
  durationMs?: number;
};

// Deduplicate within a short window to avoid flooding on repeated errors
const seenErrors = new Map<string, number>();
const DEDUP_WINDOW_MS = 10_000; // 10 seconds
const MAX_DEDUP_ENTRIES = 200;

function classifyError(value: string): string {
  const normalized = value.toLowerCase();
  if (/chunkloaderror|dynamically imported module|module script/.test(normalized)) return 'chunk_load';
  if (/timeout|timed out|aborterror/.test(normalized)) return 'timeout';
  if (/network|failed to fetch|offline|econn/.test(normalized)) return 'network';
  if (/permission|forbidden|unauthorized|401|403/.test(normalized)) return 'authorization';
  if (/not found|404/.test(normalized)) return 'not_found';
  if (/validation|invalid|schema|parse/.test(normalized)) return 'validation';
  return 'unknown';
}

async function sha256Prefix(value: string): Promise<string | null> {
  if (!globalThis.crypto?.subtle) return null;
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .slice(0, 12)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function buildSafeErrorRecord(value: string): Promise<string> {
  const category = classifyError(value);
  const fingerprint = await sha256Prefix(value);
  const length = Math.min(value.length, 999_999);
  return fingerprint
    ? `category=${category};fingerprint=${fingerprint};length=${length}`
    : `category=${category};length=${length}`;
}

function safeDiagnosticLabel(value: string, maxLength: number): string {
  const normalized = value
    .replace(/[^A-Za-z0-9_.:-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, maxLength);
  return normalized || 'unknown';
}

function pruneSeenErrors(now: number): void {
  for (const [key, timestamp] of seenErrors) {
    if (now - timestamp > DEDUP_WINDOW_MS * 2) {
      seenErrors.delete(key);
    }
  }

  while (seenErrors.size >= MAX_DEDUP_ENTRIES) {
    const oldestKey = seenErrors.keys().next().value as string | undefined;
    if (!oldestKey) break;
    seenErrors.delete(oldestKey);
  }
}

export function resetErrorReporterStateForTests(): void {
  seenErrors.clear();
}

function dedupKey(payload: ErrorReportPayload, error: string): string {
  return `${payload.flowId || 'global'}::${payload.operation || payload.function}::${payload.outcome || 'failed'}::${error.slice(0, 120)}`;
}

export function getSafePageUrl(): string | null {
  if (typeof window === 'undefined') return null;
  return `${window.location.origin}${window.location.pathname}`.slice(0, 512);
}

export async function sendErrorReport(payload: ErrorReportPayload): Promise<'sent' | 'skipped'> {
  // The error_logs table intentionally has no anonymous INSERT policy. Only
  // authenticated sessions may attempt remote reporting, otherwise every
  // warning would generate a guaranteed 401 request in the browser.
  const { supabase } = await import('@/utils/supabase');
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    return 'skipped';
  }

  // Raw Error.message is intentionally never persisted. It is an unbounded
  // third-party input surface and can contain credentials in formats no
  // regular-expression redactor can exhaustively enumerate.
  const safeError = await buildSafeErrorRecord(payload.error);
  const key = dedupKey(payload, safeError);
  const now = Date.now();
  const lastSent = seenErrors.get(key);

  if (lastSent && now - lastSent < DEDUP_WINDOW_MS) {
    return 'skipped';
  }
  // Record the attempt before awaiting I/O so concurrent identical failures
  // collapse into one request. A failed request can retry after the window.
  pruneSeenErrors(now);
  seenErrors.set(key, now);

  const { error } = await supabase
    .from(ERROR_LOGS_TABLE)
    .insert({
      module: safeDiagnosticLabel(payload.module, 64),
      function: safeDiagnosticLabel(payload.function, 128),
      error: safeError,
      level: payload.level || 'error',
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 256) : null,
      url: getSafePageUrl(),
      flow_id: payload.flowId ? safeDiagnosticLabel(payload.flowId, 64) : null,
      feature: payload.feature ? safeDiagnosticLabel(payload.feature, 32) : null,
      season: payload.season ? safeDiagnosticLabel(payload.season, 8) : null,
      round: payload.round ? safeDiagnosticLabel(payload.round, 8) : null,
      section: payload.section ? safeDiagnosticLabel(payload.section, 32) : null,
      session: payload.session ? safeDiagnosticLabel(payload.session, 8) : null,
      operation: payload.operation ? safeDiagnosticLabel(payload.operation, 96) : null,
      outcome: payload.outcome ? safeDiagnosticLabel(payload.outcome, 24) : null,
      source: payload.source ? safeDiagnosticLabel(payload.source, 32) : null,
      reason_code: payload.reasonCode ? safeDiagnosticLabel(payload.reasonCode, 32) : null,
      duration_ms: Number.isFinite(payload.durationMs) ? Math.max(0, Math.round(payload.durationMs!)) : null,
    });
  if (error) {
    throw error;
  }
  return 'sent';
}

export function reportError(payload: ErrorReportPayload): void {
  void sendErrorReport(payload).catch(() => {
    // Error reporting must never create a second user-visible failure.
  });
}
