import { describe, expect, it } from 'vitest';
import { canonicalNewsUrl, mergeNewsItems, normalizeNewsItem, formatNewsTimestamp } from './news';
import { NEWS_SOURCES } from '@/data/newsSources';

const source = NEWS_SOURCES[0];
const now = Date.parse('2026-10-21T10:00:00Z');

describe('news metadata validation', () => {
  it('keeps only link metadata instead of retaining a feed introduction', () => {
    const result = normalizeNewsItem({ title: 'F1 update', url: 'https://www.motorsport.com/f1/news/update/',
      publishedAt: '2026-10-21T08:00:00Z' }, source, now);
    expect(Object.keys(result!).sort()).toEqual(['id', 'kind', 'publishedAt', 'sourceId', 'title', 'url']);
  });
  it('normalizes source links and strips tracking while preserving content parameters', () => {
    expect(canonicalNewsUrl('https://www.motorsport.com/f1/news/story/42/?utm_source=RSS&page=2#comments', source))
      .toBe('https://www.motorsport.com/f1/news/story/42/?page=2');
    expect(canonicalNewsUrl('https://motorsport.com/f1/news/story/42/', source)).toBe('https://www.motorsport.com/f1/news/story/42/');
    for (const url of ['javascript:alert(1)', 'http://www.motorsport.com/f1/', 'https://evil.test/',
      'https://www.motorsport.com.evil.test/', 'https://user:pass@www.motorsport.com/f1/', 'https://www.motorsport.com:1234/f1/']) {
      expect(canonicalNewsUrl(url, source)).toBeNull();
    }
  });

  it('requires a title, source-owned URL and real publication time instead of fabricating freshness', () => {
    const fields = { title: '  F1   update  ', url: 'https://www.motorsport.com/f1/news/update/', publishedAt: 'Wed, 21 Oct 2026 08:00:00 GMT' };
    expect(normalizeNewsItem(fields, source, now)).toMatchObject({ title: 'F1 update', kind: 'news', publishedAt: '2026-10-21T08:00:00.000Z' });
    expect(normalizeNewsItem({ ...fields, publishedAt: '' }, source, now)).toBeNull();
    expect(normalizeNewsItem({ ...fields, publishedAt: 'wrong' }, source, now)).toBeNull();
    expect(normalizeNewsItem({ ...fields, publishedAt: '2026-10-22T08:00:00Z' }, source, now)).toBeNull();
    expect(normalizeNewsItem({ ...fields, title: '   ' }, source, now)).toBeNull();
  });

  it('only admits F1-specific FIA announcements', () => {
    const fields = { url: 'https://www.fia.com/news/update', publishedAt: '2026-10-21T08:00:00Z' };
    const fia = NEWS_SOURCES.find(item => item.id === 'fia')!;
    expect(normalizeNewsItem({ ...fields, title: 'FIA opens new F1 operations centre' }, fia, now)?.kind).toBe('official');
    expect(normalizeNewsItem({ ...fields, title: 'FIA World Rally update' }, fia, now)).toBeNull();
  });

  it('only admits Reddit links to original formula1 posts', () => {
    const reddit = { ...source, id: 'reddit' as const, hosts: ['www.reddit.com', 'reddit.com'], kind: 'social' as const };
    const fields = { title: 'Community discussion', publishedAt: '2026-10-21T08:00:00Z' };
    expect(normalizeNewsItem({ ...fields, url: 'https://reddit.com/r/formula1/comments/abc123/discussion/?utm_source=rss' }, reddit, now))
      .toMatchObject({ sourceId: 'reddit', kind: 'social', url: 'https://www.reddit.com/r/formula1/comments/abc123/discussion/' });
    for (const path of ['/r/other/comments/abc123/title/', '/user/example/', '/r/formula1/', '/r/formula1/comments/abc123/title/comment/']) {
      expect(normalizeNewsItem({ ...fields, url: `https://www.reddit.com${path}` }, reddit, now)).toBeNull();
    }
  });

  it('deduplicates canonical URLs and sorts newest first without mutating input', () => {
    const older = normalizeNewsItem({ title: 'Older', url: 'https://www.motorsport.com/f1/news/old/', publishedAt: '2026-10-20T08:00:00Z' }, source, now)!;
    const newer = normalizeNewsItem({ title: 'Newer', url: 'https://www.motorsport.com/f1/news/new/', publishedAt: '2026-10-21T08:00:00Z' }, source, now)!;
    const input = [older, newer, { ...newer }];
    expect(mergeNewsItems(input).map(item => item.title)).toEqual(['Newer', 'Older']);
    expect(input).toHaveLength(3);
    expect(mergeNewsItems([newer, { ...newer, title: 'Old duplicate', publishedAt: older.publishedAt }])[0].title).toBe('Newer');
  });

  it('formats publication times in the selected fixed offset, including date rollover', () => {
    expect(formatNewsTimestamp('2026-10-21T20:30:00Z', 480)).toBe('2026-10-22 04:30');
    expect(formatNewsTimestamp('2026-10-21T20:30:00Z', -300)).toBe('2026-10-21 15:30');
  });
});
