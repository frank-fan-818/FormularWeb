/**
 * Generic timeout + exponential-backoff retry utility.
 *
 * Rules (from reliability skill §2):
 * - External calls MUST have a timeout.
 * - Retry at most 3 times with exponential backoff (1s → 2s → 4s).
 * - Only retry on TimeoutError, HTTP 429, or HTTP 5xx.
 * - Never retry on HTTP 4xx client errors or business logic errors.
 */

export interface RetryOptions {
  /** Maximum retry attempts (default 3). */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff (default 1000). */
  baseDelayMs?: number;
  /** Timeout in ms for each attempt. */
  timeoutMs?: number;
  /** Callback invoked before each retry. */
  onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  timeoutMs: 5000,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a Promise with a timeout. If the promise doesn't resolve within
 * `timeoutMs`, it rejects with a TimeoutError.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  if (timeoutMs <= 0) return promise;

  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`操作超时 (${timeoutMs}ms)`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeout]);
    return result;
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

/**
 * Determine if an error is retryable.
 * Retry on: TimeoutError, HTTP 429 (rate limit), HTTP 5xx (server errors).
 * Do NOT retry on: HTTP 4xx (client errors), other errors.
 */
function isRetryable(error: Error): boolean {
  const message = error.message.toLowerCase();
  // Timeout
  if (message.includes('timeout') || message.includes('超时')) return true;
  // Axios-style HTTP errors
  if ('response' in (error as unknown as Record<string, unknown>)) {
    const status = (error as unknown as { response?: { status?: number } }).response?.status;
    if (status !== undefined) {
      // 429 Too Many Requests, or 5xx Server Error
      return status === 429 || (status >= 500 && status <= 599);
    }
  }
  return false;
}

/**
 * Execute an async function with retry logic.
 *
 * Each attempt is wrapped in a timeout. On failure, if the error is retryable
 * and we're under maxRetries, we wait with exponential backoff and retry.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { maxRetries, baseDelayMs, timeoutMs } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await withTimeout(fn(), timeoutMs);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries && isRetryable(lastError)) {
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt), 8000);
        options.onRetry?.(attempt + 1, lastError);
        await sleep(delay);
        continue;
      }

      throw lastError;
    }
  }

  // Unreachable — the loop above always either returns or throws
  throw lastError ?? new Error('withRetry: unexpected end');
}
