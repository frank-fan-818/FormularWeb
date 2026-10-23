import { afterEach, expect, it, vi } from 'vitest';
import { withRetry } from './withRetry';
afterEach(() => vi.useRealTimers());
it('does not wait past the total interactive budget for a long Retry-After', async () => {
  vi.useFakeTimers();
  const request = vi.fn().mockRejectedValue(Object.assign(new Error('limited'), { status: 429, retryAfterMs: 60_000 }));
  const pending = withRetry(request, { timeoutMs: 4000, maxRetries: 1, totalTimeoutMs: 10_000 });
  const check = expect(pending).rejects.toThrow();
  await vi.advanceTimersByTimeAsync(10_001);
  await check;
  expect(request).toHaveBeenCalledTimes(1);
});
it('stops all attempts by the total deadline', async () => {
  vi.useFakeTimers();
  const request = vi.fn(() => new Promise(() => undefined));
  const pending = withRetry(request, { timeoutMs: 4000, maxRetries: 3, totalTimeoutMs: 6000, jitterRatio: 0 });
  const check = expect(pending).rejects.toThrow(/timeout/i);
  await vi.advanceTimersByTimeAsync(6001);
  await check;
  expect(request).toHaveBeenCalledTimes(2);
});
