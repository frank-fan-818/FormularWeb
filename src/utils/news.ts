import type { NewsItem, NewsKind, NewsSource } from '@/types/news';
import { normalizeTimeZoneOffset } from '@/utils/timeZone';

export function canonicalNewsUrl(value: string, source: NewsSource): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !source.hosts.includes(url.hostname)) return null;
    url.hostname = source.hosts[0];
    url.hash = '';
    [...url.searchParams.keys()].forEach(key => {
      if (/^utm_/i.test(key) || /^(fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
    });
    url.searchParams.sort();
    return url.href;
  } catch {
    return null;
  }
}

export function normalizeNewsItem(
  fields: { title: string; url: string; publishedAt: string },
  source: NewsSource,
  now = Date.now(),
): NewsItem | null {
  const title = fields.title.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]*>/g, '').replace(/\p{Cc}/gu, ' ').replace(/\s+/g, ' ').trim();
  const url = canonicalNewsUrl(fields.url.trim(), source);
  const timestamp = Date.parse(fields.publishedAt);
  if (!title || title.length > 500 || !url || !Number.isFinite(timestamp) || timestamp > now + 300_000) return null;
  if (source.id === 'reddit' && !/^\/r\/formula1\/comments\/[a-z0-9]+(?:\/[^/]+)?\/?$/i.test(new URL(url).pathname)) return null;
  if (source.id === 'fia' && !/\b(?:F1|Formula\s+(?:1|One))\b/i.test(title)) return null;
  return { id: url, sourceId: source.id, kind: source.kind, title, url, publishedAt: new Date(timestamp).toISOString() };
}

export function mergeNewsItems(items: readonly NewsItem[]): NewsItem[] {
  const sorted = [...items].sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt));
  const unique = new Map<string, NewsItem>();
  sorted.forEach(item => { if (!unique.has(item.url)) unique.set(item.url, item); });
  return [...unique.values()];
}

export function filterNewsItems(items: readonly NewsItem[], filters: { kind: NewsKind | 'all'; sourceId: string; query: string }): NewsItem[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return items.filter(item => (filters.kind === 'all' || item.kind === filters.kind)
    && (filters.sourceId === 'all' || item.sourceId === filters.sourceId)
    && (!query || item.title.toLocaleLowerCase().includes(query)));
}

export function parseNewsFeed(xml: string, source: NewsSource, now = Date.now()): NewsItem[] {
  if (xml.length > 1_000_000 || /<!DOCTYPE/i.test(xml)) throw new Error('Invalid news document');
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (source.format === 'atom') {
    if (document.querySelector('parsererror') || document.documentElement.localName !== 'feed'
      || document.documentElement.namespaceURI !== 'http://www.w3.org/2005/Atom') throw new Error('Invalid Atom document');
    const entries = Array.from(document.documentElement.children).filter(node => node.localName === 'entry');
    return mergeNewsItems(entries.slice(0, 50).flatMap(entry => {
      const children = Array.from(entry.children);
      const link = children.find(node => node.localName === 'link' && (!node.getAttribute('rel') || node.getAttribute('rel') === 'alternate'));
      const news = normalizeNewsItem({
        title: children.find(node => node.localName === 'title')?.textContent ?? '',
        url: link?.getAttribute('href') ?? '',
        publishedAt: children.find(node => node.localName === 'published')?.textContent ?? '',
      }, source, now);
      return news ? [news] : [];
    }));
  }
  if (document.querySelector('parsererror') || document.documentElement.localName !== 'rss' || !document.querySelector('channel')) {
    throw new Error('Invalid RSS document');
  }
  const items = Array.from(document.querySelectorAll('channel > item')).slice(0, 200).flatMap(item => {
    const news = normalizeNewsItem({
      title: item.querySelector('title')?.textContent ?? '',
      url: item.querySelector('link')?.textContent ?? '',
      publishedAt: item.querySelector('pubDate')?.textContent ?? '',
    }, source, now);
    return news ? [news] : [];
  });
  return mergeNewsItems(items);
}

export function formatNewsTimestamp(value: string, offsetMinutes: number): string {
  return new Date(Date.parse(value) + normalizeTimeZoneOffset(offsetMinutes) * 60_000)
    .toISOString().slice(0, 16).replace('T', ' ');
}
