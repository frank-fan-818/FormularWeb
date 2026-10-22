import type { NewsSource } from '@/types/news';

export const NEWS_SOURCES: readonly NewsSource[] = [
  { id: 'motorsport', name: 'Motorsport.com', endpoint: '/news-feed/motorsport',
    website: 'https://www.motorsport.com/f1/', hosts: ['www.motorsport.com', 'motorsport.com'], kind: 'news' },
  { id: 'fia', name: 'FIA', endpoint: '/news-feed/fia',
    website: 'https://www.fia.com/news', hosts: ['www.fia.com', 'fia.com'], kind: 'official' },
  { id: 'reddit', name: 'Reddit · r/formula1', endpoint: '/news-feed/reddit',
    website: 'https://www.reddit.com/r/formula1/', hosts: ['www.reddit.com', 'reddit.com'], kind: 'social', format: 'atom' },
];
