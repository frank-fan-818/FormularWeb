import { withRetry, RequestTimeoutError } from '../utils/withRetry';

export class FiaSourceUnavailableError extends Error {
  constructor(public readonly reason: string) { super(`FIA source unavailable: ${reason}`); }
}

export async function requestFiaDocument<T>(
  url: string, consume: (response: Response) => Promise<T>,
  fetcher: typeof fetch = fetch,
): Promise<T> {
  const parsed = new URL(url);
  if (parsed.origin !== 'https://www.fia.com') throw new Error('Untrusted FIA source URL');
  try {
    return await withRetry(async signal => {
      const response = await fetcher(url, { signal });
      if (!response.ok) {
        await response.body?.cancel();
        // A public FIA endpoint can deny cloud runners temporarily. This does
        // not classify database/authentication errors as source unavailability.
        if ([403, 404].includes(response.status)) throw new FiaSourceUnavailableError(`HTTP ${response.status}`);
        throw Object.assign(new Error(`FIA HTTP ${response.status}`), { status: response.status });
      }
      return consume(response);
    }, { timeoutMs: 30_000, maxRetries: 2, baseDelayMs: 1000 });
  } catch (error) {
    const status = (error as { status?: number })?.status;
    if (error instanceof RequestTimeoutError || error instanceof TypeError
      || status === 408 || status === 429 || (status !== undefined && status >= 500)) {
      throw new FiaSourceUnavailableError(status ? `HTTP ${status}` : 'network/timeout');
    }
    throw error;
  }
}

export async function requestFiaHtml(url: string): Promise<string> {
  return requestFiaDocument(url, async response => {
    const html = await response.text();
    if (html.includes('/.maintenance/') || /temporarily to follow the latest FIA news/i.test(html)) {
      throw new FiaSourceUnavailableError('maintenance page');
    }
    return html;
  });
}
