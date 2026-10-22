import { NEWS_SOURCES } from '@/data/newsSources';
import type { NewsItem, NewsResult, NewsSource, NewsSourceState } from '@/types/news';
import { mergeNewsItems, normalizeNewsItem, parseNewsFeed } from '@/utils/news';
import { withRetry } from '@/utils/withRetry';
import { logger } from '@/utils/logger';

const CACHE_TTL_MS = 5 * 60_000;
const cache = new Map<string, { items: NewsItem[]; updatedAt: string; expiresAt: number }>();
const REDDIT_CACHE_KEY = 'f1-reddit-feed-v1';
const REDDIT_CACHE_MAX_AGE_MS = 24 * 60 * 60_000;

function restoreRedditCache(source: NewsSource) {
  if (source.id !== 'reddit') return undefined;
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(REDDIT_CACHE_KEY) || 'null');
    if (!saved || typeof saved !== 'object' || !('updatedAt' in saved) || typeof saved.updatedAt !== 'string'
      || !('items' in saved) || !Array.isArray(saved.items)) return undefined;
    const age = Date.now() - Date.parse(saved.updatedAt);
    if (!Number.isFinite(age) || age < 0 || age > REDDIT_CACHE_MAX_AGE_MS) return undefined;
    const items = saved.items.slice(0, 50).flatMap((item: unknown) => {
      if (!item || typeof item !== 'object' || !('title' in item) || typeof item.title !== 'string'
        || !('url' in item) || typeof item.url !== 'string' || !('publishedAt' in item) || typeof item.publishedAt !== 'string') return [];
      const normalized = normalizeNewsItem({ title: item.title, url: item.url, publishedAt: item.publishedAt }, source);
      return normalized ? [normalized] : [];
    });
    return { items: mergeNewsItems(items), updatedAt: saved.updatedAt, expiresAt: 0 };
  } catch { return undefined; }
}

export function clearNewsCache(): void { cache.clear(); }

async function getSource(source: NewsSource, refresh: boolean, signal?: AbortSignal) {
  let cached = cache.get(source.id) ?? restoreRedditCache(source);
  if (source.id === 'reddit' && cached && Date.now() - Date.parse(cached.updatedAt) > REDDIT_CACHE_MAX_AGE_MS) {
    cache.delete(source.id);
    cached = undefined;
  }
  if (!refresh && cached && cached.expiresAt > Date.now()) {
    return { items: cached.items, state: { sourceId: source.id, status: 'ready', updatedAt: cached.updatedAt } satisfies NewsSourceState };
  }
  try {
    const items = await withRetry(async requestSignal => {
      const response = await fetch(source.endpoint, { signal: requestSignal, headers: { Accept: 'application/atom+xml, application/rss+xml, application/xml, text/xml' } });
      if (!response.ok || !/(?:application|text)\/(?:atom\+xml|rss\+xml|xml)(?:;|$)/i.test(response.headers.get('Content-Type') || '')) {
        throw new Error(`News source unavailable (${response.status})`);
      }
      return parseNewsFeed(await response.text(), source);
    }, { signal, timeoutMs: 10_000, maxRetries: 0 });
    if (signal?.aborted) throw new DOMException('Request aborted', 'AbortError');
    const updatedAt = new Date().toISOString();
    cache.set(source.id, { items, updatedAt, expiresAt: Date.now() + CACHE_TTL_MS });
    if (source.id === 'reddit') {
      try { localStorage.setItem(REDDIT_CACHE_KEY, JSON.stringify({ items, updatedAt })); } catch { /* Private browsing may disable storage. */ }
    }
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

export async function getNews(options: { refresh?: boolean; signal?: AbortSignal } = {}): Promise<NewsResult> {
  if (options.signal?.aborted) throw new DOMException('Request aborted', 'AbortError');
  const results = await Promise.all(NEWS_SOURCES.map(source => getSource(source, Boolean(options.refresh), options.signal)));
  return { items: mergeNewsItems(results.flatMap(result => result.items)), sources: results.map(result => result.state) };
}
