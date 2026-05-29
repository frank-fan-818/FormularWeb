/**
 * Tests for src/utils/withRetry.ts
 */
import { describe, it, expect, vi } from 'vitest';
import { withRetry, withTimeout } from '@/utils/withRetry';

describe('withTimeout', () => {
  it('resolves when promise finishes before timeout', async () => {
    const result = await withTimeout(Promise.resolve('done'), 1000);
    expect(result).toBe('done');
  });

  it('rejects with timeout error when promise takes too long', async () => {
    vi.useFakeTimers();
    const slow = new Promise((resolve) => setTimeout(resolve, 5000));

    const promise = withTimeout(slow, 100);
    vi.advanceTimersByTime(200);
    await expect(promise).rejects.toThrow(/超时/);
    vi.clearAllTimers();
    vi.useRealTimers();
  });
});

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn, { timeoutMs: 1000 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on timeout and succeeds', async () => {
    vi.useFakeTimers();

    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('操作超时 (100ms)'))
      .mockResolvedValueOnce('recovered');

    const promise = withRetry(fn, { maxRetries: 3, baseDelayMs: 100, timeoutMs: 50 });

    // Let first attempt fail, then advance past backoff
    await vi.advanceTimersByTimeAsync(50);  // first timeout
    await vi.advanceTimersByTimeAsync(150); // backoff + second attempt

    const result = await promise;
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);

    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('stops retrying after maxRetries exhausted', async () => {
    vi.useFakeTimers();

    const timeoutErr = new Error('操作超时 (100ms)');
    const fn = vi.fn().mockRejectedValue(timeoutErr);

    const promise = withRetry(fn, { maxRetries: 2, baseDelayMs: 100, timeoutMs: 50 });

    // Run all timers to completion so no pending timers leak
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow(/超时/);
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries

    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('does not retry on 404 client errors', async () => {
    const err = new Error('Not Found');
    // Attach HTTP response-like property for isRetryable check
    Object.defineProperty(err, 'response', {
      value: { status: 404 },
      writable: true,
      configurable: true,
    });
    const fn = vi.fn().mockRejectedValue(err);

    await expect(
      withRetry(fn, { maxRetries: 3, baseDelayMs: 10 }),
    ).rejects.toThrow('Not Found');

    expect(fn).toHaveBeenCalledTimes(1); // no retry — 404 is not retryable
  });

  it('retries on HTTP 429 rate limit', async () => {
    vi.useFakeTimers();

    const rateLimitErr = new Error('Rate limited');
    Object.defineProperty(rateLimitErr, 'response', {
      value: { status: 429 },
      writable: true,
      configurable: true,
    });
    const fn = vi.fn()
      .mockRejectedValueOnce(rateLimitErr)
      .mockResolvedValueOnce('ok');

    const promise = withRetry(fn, { maxRetries: 3, baseDelayMs: 100, timeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(200);

    const result = await promise;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);

    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('retries on HTTP 503 server error', async () => {
    vi.useFakeTimers();

    const serverErr = new Error('Service Unavailable');
    Object.defineProperty(serverErr, 'response', {
      value: { status: 503 },
      writable: true,
      configurable: true,
    });
    const fn = vi.fn()
      .mockRejectedValueOnce(serverErr)
      .mockResolvedValueOnce('recovered');

    const promise = withRetry(fn, { maxRetries: 2, baseDelayMs: 100, timeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(200);

    const result = await promise;
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);

    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('calls onRetry callback with attempt number', async () => {
    vi.useFakeTimers();

    const timeoutErr = new Error('操作超时 (100ms)');
    const fn = vi.fn()
      .mockRejectedValueOnce(timeoutErr)
      .mockResolvedValueOnce('done');

    const onRetry = vi.fn();
    const promise = withRetry(fn, { maxRetries: 3, baseDelayMs: 100, timeoutMs: 50, onRetry });

    await vi.advanceTimersByTimeAsync(50);   // first attempt timeout
    await vi.advanceTimersByTimeAsync(150);  // backoff + second attempt

    await promise;
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));

    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('does not retry on business logic errors (not timeout/HTTP/network)', async () => {
    const businessErr = new Error('Invalid input data');
    const fn = vi.fn().mockRejectedValue(businessErr);

    await expect(
      withRetry(fn, { maxRetries: 3, baseDelayMs: 10 }),
    ).rejects.toThrow('Invalid input data');

    expect(fn).toHaveBeenCalledTimes(1);
  });
});
