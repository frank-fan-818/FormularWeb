export class RequestTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Request timeout (${timeoutMs}ms)`);
    this.name = 'RequestTimeoutError';
  }
}

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  jitterRatio?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_OPTIONS = {
  maxRetries: 2,
  baseDelayMs: 350,
  timeoutMs: 8000,
  jitterRatio: 0.2,
};

function abortError(): DOMException {
  return new DOMException('Request aborted', 'AbortError');
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    throwIfAborted(signal);
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(abortError());
    }, { once: true });
  });
}

export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  if (timeoutMs <= 0) return promise;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new RequestTimeoutError(timeoutMs)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function statusOf(error: Error): number | undefined {
  const candidate = error as Error & { response?: { status?: number }; status?: number };
  return candidate.response?.status ?? candidate.status;
}

function retryAfterMsOf(error: Error): number {
  const value = (error as Error & { retryAfterMs?: number }).retryAfterMs;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

export function isRetryableRequestError(error: Error): boolean {
  if (error.name === 'AbortError') return false;
  if (error instanceof RequestTimeoutError || /timeout|network|failed to fetch/i.test(error.message)) return true;
  const status = statusOf(error);
  return status === 408 || status === 429 || (status !== undefined && status >= 500 && status <= 599);
}

function linkAbortSignal(parent: AbortSignal | undefined, child: AbortController): () => void {
  if (!parent) return () => undefined;
  const abort = () => child.abort(parent.reason);
  parent.addEventListener('abort', abort, { once: true });
  return () => parent.removeEventListener('abort', abort);
}

export async function withRetry<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const settings = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= settings.maxRetries; attempt += 1) {
    throwIfAborted(settings.signal);
    const attemptController = new AbortController();
    const unlink = linkAbortSignal(settings.signal, attemptController);
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      if (settings.timeoutMs <= 0) {
        return await fn(attemptController.signal);
      }
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new RequestTimeoutError(settings.timeoutMs));
          attemptController.abort();
        }, settings.timeoutMs);
      });
      return await Promise.race([fn(attemptController.signal), timeoutPromise]);
    } catch (value) {
      lastError = value instanceof Error ? value : new Error(String(value));
      if (settings.signal?.aborted) throw abortError();
      if (attempt >= settings.maxRetries || !isRetryableRequestError(lastError)) throw lastError;

      options.onRetry?.(attempt + 1, lastError);
      const exponential = Math.min(settings.baseDelayMs * (2 ** attempt), 8000);
      const jitter = exponential * settings.jitterRatio * ((Math.random() * 2) - 1);
      await sleep(Math.max(retryAfterMsOf(lastError), exponential + jitter, 0), settings.signal);
    } finally {
      if (timer) clearTimeout(timer);
      unlink();
    }
  }

  throw lastError ?? new Error('Request failed');
}
