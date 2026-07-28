/**
 * Production error reporter — sends logger.error() calls to Supabase.
 * Dev-only: monitor page. Production: errors go to Supabase error_logs table.
 *
 * Fire-and-forget: does not block the caller, silently fails if unreachable.
 */
const ERROR_LOGS_TABLE = 'error_logs';

// Deduplicate within a short window to avoid flooding on repeated errors
const seenErrors = new Map<string, number>();
const DEDUP_WINDOW_MS = 10_000; // 10 seconds

function dedupKey(module: string, fnName: string, error: string): string {
  return `${module}::${fnName}::${error.slice(0, 120)}`;
}

export function getSafePageUrl(): string | null {
  if (typeof window === 'undefined') return null;
  return `${window.location.origin}${window.location.pathname}`.slice(0, 512);
}

export function reportError(payload: {
  module: string;
  function: string;
  error: string;
  level?: 'error' | 'warn';
}): void {
  // The error_logs table intentionally has no anonymous INSERT policy. Only
  // authenticated sessions may attempt remote reporting, otherwise every
  // warning would generate a guaranteed 401 request in the browser.
  void import('@/utils/supabase').then(({ supabase }) => supabase.auth.getSession().then(({ data }) => {
    if (!data.session) {
      return;
    }

    const key = dedupKey(payload.module, payload.function, payload.error);
    const now = Date.now();
    const lastSent = seenErrors.get(key);

    if (lastSent && now - lastSent < DEDUP_WINDOW_MS) {
      return;
    }
    seenErrors.set(key, now);

    if (seenErrors.size > 200) {
      for (const [k, ts] of seenErrors) {
        if (now - ts > DEDUP_WINDOW_MS * 2) seenErrors.delete(k);
      }
    }

    return supabase
      .from(ERROR_LOGS_TABLE)
      .insert({
        module: payload.module,
        function: payload.function,
        error: payload.error,
        level: payload.level || 'error',
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 256) : null,
        url: getSafePageUrl(),
      });
  })).catch(() => {
    // Error reporting must never create a second user-visible failure.
  });
}
