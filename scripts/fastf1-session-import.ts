import { setTimeout } from 'node:timers/promises';

export function databaseDiagnostic(error: unknown) {
  const value = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const candidate = String(value.code ?? '');
  // PostgREST wraps fetch/abort failures as { error, status: 0 }. Keep the
  // response status: error.code alone is often empty for these failures.
  const status = typeof value.status === 'number' && Number.isInteger(value.status)
    && value.status >= 0 && value.status <= 599 ? value.status : null;
  const code = /^[A-Z0-9_]{1,32}$/i.test(candidate) ? candidate : 'database_error';
  const transient = status === 401 || status === 403 ? false
    : status === 0 || status === 408 || status === 429 || (status !== null && status >= 500)
      || ['40001', '40P01', '53300', '57P01', '57P02', '57P03'].includes(code)
      || (status === null && ['TypeError', 'TimeoutError', 'AbortError'].includes(String(value.name)));
  return { code, status, transient };
}

export async function importIndependently<T extends { season: number; round: number; session: string }>(
  rows: T[],
  upsert: (row: T, timeoutMs: number) => Promise<void>,
  { sleep = setTimeout, now = () => performance.now() }: {
    sleep?: (ms: number) => Promise<unknown>;
    now?: () => number;
  } = {},
) {
  let imported = 0;
  const failed: Array<{ key: string; code: string; status: number | null; attempts: number; transient: boolean }> = [];
  const recovered: Array<{ key: string; attempts: number }> = [];
  const delays = [5000, 15000, 30000];
  const deadline = now() + 600000;
  for (const row of rows) {
    const key = `${row.season}/${row.round}/${row.session}`;
    // Only repeat the same idempotent upsert, with an unchanged payload and key.
    for (let attempt = 0; ; attempt++) {
      const remaining = Math.floor(deadline - now());
      if (remaining <= 0) {
        failed.push({ key, code: 'runtime_budget', status: null, transient: true, attempts: attempt });
        break;
      }
      try {
        await upsert(row, Math.min(60000, remaining));
        imported += 1;
        if (attempt > 0) recovered.push({ key, attempts: attempt + 1 });
        break;
      } catch (error) {
        const diagnostic = databaseDiagnostic(error);
        if (!diagnostic.transient || attempt >= delays.length || deadline - now() <= delays[attempt]) {
          failed.push({ key, ...diagnostic, attempts: attempt + 1 });
          break;
        }
        await sleep(delays[attempt]);
      }
    }
  }
  return { imported, failed, recovered };
}
