import { afterEach, describe, expect, it, vi } from 'vitest';
import { getNews, getCachedNews, clearNewsCache } from './news';
import { parseNewsFeed } from '@/utils/news';
import type { NewsSource } from '@/types/news';

vi.mock('@/utils/news', async importOriginal => {
  const original = await importOriginal<typeof import('@/utils/news')>();
  return { ...original, parseNewsFeed: vi.fn((xml: string, source: NewsSource) => [original.normalizeNewsItem({
    title: source.id === 'fia' ? `F1 ${xml}` : xml,
    url: source.id === 'reddit' ? 'https://www.reddit.com/r/formula1/comments/abc123/discussion/' : source.id === 'fia' ? 'https://www.fia.com/news/f1-update' : `https://www.motorsport.com/${source.id}`,
    publishedAt: '2026-10-21T08:00:00Z',
  }, source)!]) };
});

afterEach(() => { clearNewsCache(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
const feed = (body = 'Headline') => new Response(body, { headers: { 'Content-Type': 'application/rss+xml' } });

describe('independent news source loading', () => {
  it('publishes completed sources while another source is still pending', async () => {
    let releaseFia!: (response: Response) => void;
    const fia = new Promise<Response>(resolve => { releaseFia = resolve; });
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockImplementation(async url =>
      url === '/news-feed/fia' ? fia : feed()));
    const onUpdate = vi.fn();
    let complete = false;
    const pending = getNews({ onUpdate }).then(result => { complete = true; return result; });
    await vi.waitFor(() => expect(onUpdate.mock.lastCall?.[0].items).toHaveLength(2));
    expect(complete).toBe(false);
    expect(onUpdate.mock.lastCall?.[0].sources.find((source: { sourceId: string }) => source.sourceId === 'fia'))
      .toMatchObject({ status: 'loading', refreshing: true });
    releaseFia(feed());
    expect((await pending).items).toHaveLength(3);
  });

  it('restores every source immediately after reload and retains timestamps when background updates fail', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-22T08:00:00Z'));
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockImplementation(async () => feed('F1 headline')));
    const fresh = await getNews();
    clearNewsCache();
    const snapshot = getCachedNews();
    expect(snapshot.items).toHaveLength(3);
    expect(snapshot.sources.every(source => source.updatedAt === '2026-10-22T08:00:00.000Z')).toBe(true);
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new Error('offline')));
    const failed = await getNews();
    expect(failed.items).toEqual(fresh.items);
    expect(failed.sources.every(source => source.status === 'stale' && source.updatedAt === fresh.sources[0].updatedAt)).toBe(true);
    vi.setSystemTime(new Date('2026-10-23T08:00:01Z'));
    expect(getCachedNews().items).toEqual([]);
  });

  it('revalidates stored source items and rejects expired or future cache timestamps', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-22T08:00:00Z'));
    const stored = { updatedAt: '2026-10-22T07:00:00Z', items: [
      { title: 'Safe story', url: 'https://www.motorsport.com/f1/news/safe/', publishedAt: '2026-10-22T06:00:00Z' },
      { title: 'Unsafe story', url: 'https://evil.test/', publishedAt: '2026-10-22T06:00:00Z' },
    ] };
    vi.stubGlobal('localStorage', { getItem: (key: string) => key === 'f1-news-feed-motorsport-v1' ? JSON.stringify(stored) : null });
    expect(getCachedNews().items.map(item => item.title)).toEqual(['Safe story']);
    clearNewsCache();
    stored.updatedAt = '2026-10-23T08:00:00Z';
    expect(getCachedNews().items).toEqual([]);
  });

  it('does not publish a cancelled source over a newer request', async () => {
    let release!: (response: Response) => void;
    const held = new Promise<Response>(resolve => { release = resolve; });
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockImplementation(() => held));
    const controller = new AbortController();
    const onUpdate = vi.fn();
    const pending = getNews({ signal: controller.signal, onUpdate });
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    const updates = onUpdate.mock.calls.length;
    release(feed());
    await rejected;
    expect(onUpdate).toHaveBeenCalledTimes(updates);
    expect(getCachedNews().items).toEqual([]);
  });

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
    expect(stale.items).toEqual(expect.arrayContaining([expect.objectContaining({ sourceId: 'reddit', title: 'Atom title' })]));
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
