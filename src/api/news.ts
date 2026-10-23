import { NEWS_SOURCES } from '@/data/newsSources';
import type { NewsItem, NewsRequestOptions, NewsResult, NewsSource, NewsSourceState } from '@/types/news';
import { mergeNewsItems, normalizeNewsItem, parseNewsFeed } from '@/utils/news';
import { withRetry } from '@/utils/withRetry';
import { logger } from '@/utils/logger';
import { measureRequest } from '@/utils/performance';

const CACHE_TTL_MS = 5 * 60_000;
const cache = new Map<string, { items: NewsItem[]; updatedAt: string; expiresAt: number }>();
const CACHE_MAX_AGE_MS = 24 * 60 * 60_000;

function storageKey(source: NewsSource): string {
  return source.id === 'reddit' ? 'f1-reddit-feed-v1' : `f1-news-feed-${source.id}-v1`;
}

function restoreSourceCache(source: NewsSource) {
  try {
    const raw = localStorage.getItem(storageKey(source));
    if (!raw || raw.length > 250_000) return undefined;
    const saved: unknown = JSON.parse(raw);
    if (!saved || typeof saved !== 'object' || !('updatedAt' in saved) || typeof saved.updatedAt !== 'string'
      || !('items' in saved) || !Array.isArray(saved.items)) return undefined;
    const age = Date.now() - Date.parse(saved.updatedAt);
    if (!Number.isFinite(age) || age < 0 || age > CACHE_MAX_AGE_MS) return undefined;
    const items = saved.items.slice(0, source.id === 'reddit' ? 50 : 200).flatMap((item: unknown) => {
      if (!item || typeof item !== 'object' || !('title' in item) || typeof item.title !== 'string'
        || !('url' in item) || typeof item.url !== 'string' || !('publishedAt' in item) || typeof item.publishedAt !== 'string') return [];
      const normalized = normalizeNewsItem({ title: item.title, url: item.url, publishedAt: item.publishedAt }, source);
      return normalized ? [normalized] : [];
    });
    return { items: mergeNewsItems(items), updatedAt: saved.updatedAt, expiresAt: 0 };
  } catch { return undefined; }
}

export function clearNewsCache(): void { cache.clear(); }

function getSourceCache(source: NewsSource) {
  const cached = cache.get(source.id) ?? restoreSourceCache(source);
  if (!cached) return undefined;
  const age = Date.now() - Date.parse(cached.updatedAt);
  if (!Number.isFinite(age) || age < 0 || age > CACHE_MAX_AGE_MS) {
    cache.delete(source.id);
    return undefined;
  }
  cache.set(source.id, cached);
  return cached;
}

export function getCachedNews(): NewsResult {
  const items: NewsItem[] = [];
  const sources = NEWS_SOURCES.map((source): NewsSourceState => {
    const cached = getSourceCache(source);
    if (cached) items.push(...cached.items);
    const refreshing = !cached || cached.expiresAt <= Date.now();
    return { sourceId: source.id, status: cached ? refreshing ? 'stale' : 'ready' : 'loading',
      updatedAt: cached?.updatedAt ?? null, refreshing };
  });
  return { items: mergeNewsItems(items), sources };
}

async function getSource(source: NewsSource, refresh: boolean, signal?: AbortSignal) {
  const cached = getSourceCache(source);
  if (!refresh && cached && cached.expiresAt > Date.now()) {
    return { items: cached.items, state: { sourceId: source.id, status: 'ready', updatedAt: cached.updatedAt } satisfies NewsSourceState };
  }
  try {
    const items = await measureRequest('fetch', `news_${source.id}`, () => withRetry(async requestSignal => {
      const response = await fetch(source.endpoint, { signal: requestSignal, headers: { Accept: 'application/atom+xml, application/rss+xml, application/xml, text/xml' } });
      if (!response.ok || !/(?:application|text)\/(?:atom\+xml|rss\+xml|xml)(?:;|$)/i.test(response.headers.get('Content-Type') || '')) {
        throw new Error(`News source unavailable (${response.status})`);
      }
      return parseNewsFeed(await response.text(), source);
    }, { signal, timeoutMs: 6000, maxRetries: 0 }));
    if (signal?.aborted) throw new DOMException('Request aborted', 'AbortError');
    const updatedAt = new Date().toISOString();
    cache.set(source.id, { items, updatedAt, expiresAt: Date.now() + CACHE_TTL_MS });
    try { localStorage.setItem(storageKey(source), JSON.stringify({ items, updatedAt })); } catch { /* Private browsing may disable storage. */ }
    return { items, state: { sourceId: source.id, status: 'ready', updatedAt } satisfies NewsSourceState };
  } catch (error) {
    if (signal?.aborted) throw error;
    logger.debug({ event: 'step', module: 'news', function: 'getSource', input: source.id, status: 'failed' });
    return {
      items: cached?.items ?? [],
      state: { sourceId: source.id, status: cached ? 'stale' : 'error', updatedAt: cached?.updatedAt ?? null } satisfies NewsSourceState,
    };
  }
}

export async function getNews(options: NewsRequestOptions = {}): Promise<NewsResult> {
  if (options.signal?.aborted) throw new DOMException('Request aborted', 'AbortError');
  const cached = getCachedNews();
  const results = cached.sources.map(state => ({
    items: cached.items.filter(item => item.sourceId === state.sourceId),
    state: { ...state, refreshing: Boolean(options.refresh) || Boolean(state.refreshing) },
  }));
  const snapshot = (): NewsResult => ({
    items: mergeNewsItems(results.flatMap(result => result.items)), sources: results.map(result => result.state),
  });
  options.onUpdate?.(snapshot());
  await Promise.all(NEWS_SOURCES.map(async (source, index) => {
    const result = await getSource(source, Boolean(options.refresh), options.signal);
    if (options.signal?.aborted) throw new DOMException('Request aborted', 'AbortError');
    results[index] = { ...result, state: { ...result.state, refreshing: false } };
    options.onUpdate?.(snapshot());
  }));
  return snapshot();
}
