export type NewsKind = 'news' | 'official' | 'social';
export type NewsSourceId = 'motorsport' | 'fia' | 'reddit';

export interface NewsSource {
  id: NewsSourceId;
  name: string;
  endpoint: string;
  website: string;
  hosts: readonly string[];
  kind: NewsKind;
  format?: 'rss' | 'atom';
}

export interface NewsItem {
  id: string;
  sourceId: NewsSourceId;
  kind: NewsKind;
  title: string;
  url: string;
  publishedAt: string;
}

export interface NewsSourceState {
  sourceId: NewsSourceId;
  status: 'ready' | 'stale' | 'error';
  updatedAt: string | null;
}

export interface NewsResult {
  items: NewsItem[];
  sources: NewsSourceState[];
}
