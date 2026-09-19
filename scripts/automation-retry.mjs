import { setTimeout } from 'node:timers/promises';

export function isTransient(error) {
  const status = Number(error?.statusCode || error?.status);
  if (status) return status === 408 || status === 429 || status >= 500 && status <= 599;
  return ['TypeError', 'TimeoutError', 'AbortError', 'StorageUnknownError'].includes(error?.name);
}

// Only use with reads or explicitly idempotent writes. Never print upstream errors
// here: storage errors may contain private URLs or request details.
export async function retryTransient(operation, { sleep = setTimeout } = {}) {
  const delays = [5000, 15000, 30000];
  for (let attempt = 0; ; attempt++) {
    try { return await operation(); }
    catch (error) {
      if (!isTransient(error) || attempt >= delays.length) throw error;
      await sleep(delays[attempt]);
    }
  }
}
