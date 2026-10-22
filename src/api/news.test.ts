import { afterEach, describe, expect, it, vi } from 'vitest';
import { getNews, clearNewsCache } from './news';
import { parseNewsFeed } from '@/utils/news';

vi.mock('@/utils/news', async importOriginal => ({
  ...await importOriginal<typeof import('@/utils/news')>(),
  parseNewsFeed: vi.fn((xml: string, source: { id: string }) => [{
    id: source.id, sourceId: source.id, kind: 'news', title: xml,
    url: source.id === 'reddit' ? 'https://www.reddit.com/r/formula1/comments/abc123/discussion/' : `https://www.motorsport.com/${source.id}`, publishedAt: '2026-10-21T08:00:00Z',
  }]),
}));

afterEach(() => { clearNewsCache(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
const feed = (body = 'Headline') => new Response(body, { headers: { 'Content-Type': 'application/rss+xml' } });

describe('independent news source loading', () => {
  it('accepts Atom and restores validated Reddit posts after reload, but expires them after 24 hours', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-22T08:00:00Z'));
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response('Atom title', { headers: { 'Content-Type': 'application/atom+xml' } }));
    vi.stubGlobal('fetch', fetcher);
    await getNews();
    expect(storage.has('f1-reddit-feed-v1')).toBe(true);
    clearNewsCache();
    fetcher.mockRejectedValue(new Error('offline'));
    const stale = await getNews();
    expect(stale.items).toMatchObject([{ sourceId: 'reddit', title: 'Atom title' }]);
    expect(stale.sources.find(source => source.sourceId === 'reddit')?.status).toBe('stale');
    vi.setSystemTime(new Date('2026-10-23T08:00:01Z'));
    const expired = await getNews();
    expect(expired.items).toEqual([]);
    expect(expired.sources.find(source => source.sourceId === 'reddit')?.status).toBe('error');
  });

  it('does not let unavailable or corrupt browser storage prevent a live update', async () => {
    vi.stubGlobal('localStorage', { getItem: () => '{broken', setItem: () => { throw new Error('storage blocked'); } });
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockImplementation(async () => feed()));
    const result = await getNews();
    expect(result.sources.every(source => source.status === 'ready')).toBe(true);
    expect(result.items).toHaveLength(3);
  });

  it('keeps working sources available when one fails and requests only fixed same-origin URLs', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(feed()).mockRejectedValueOnce(new Error('offline'));
    vi.stubGlobal('fetch', fetcher);
    const result = await getNews();
    expect(result.items).toHaveLength(1);
    expect(result.sources.map(source => source.status)).toEqual(['ready', 'error', 'error']);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(['/news-feed/motorsport', '/news-feed/fia', '/news-feed/reddit']);
  });

  it('caches successful feeds and preserves last good source data after a failed forced refresh', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => feed());
    vi.stubGlobal('fetch', fetcher);
    await getNews();
    await getNews();
    expect(fetcher).toHaveBeenCalledTimes(3);
    fetcher.mockImplementation(async () => { throw new Error('offline'); });
    const result = await getNews({ refresh: true });
    expect(result.items).toHaveLength(3);
    expect(result.sources.every(source => source.status === 'stale' && source.updatedAt)).toBe(true);
  });

  it('rejects HTML masquerading as a successful feed and HTTP failures', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('<html>blocked</html>', { headers: { 'Content-Type': 'text/html' } }))
      .mockResolvedValueOnce(new Response('', { status: 503 })));
    const result = await getNews();
    expect(result.sources.map(source => source.status)).toEqual(['error', 'error', 'error']);
    expect(parseNewsFeed).not.toHaveBeenCalled();
  });

  it('does not treat a cancelled request as a publishable empty result', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetcher);
    await expect(getNews({ signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('bounds stalled sources with a timeout and aborts their network requests', async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockImplementation((_url, options) => {
      signals.push(options!.signal!);
      return new Promise(() => undefined);
    }));
    const pending = getNews();
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await pending;
    expect(result.sources.every(source => source.status === 'error')).toBe(true);
    expect(signals.every(signal => signal.aborted)).toBe(true);
  });
});
