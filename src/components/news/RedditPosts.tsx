import { useTranslation } from '@/i18n';
import type { NewsItem } from '@/types/news';
import { formatNewsTimestamp } from '@/utils/news';
import { formatUtcOffset } from '@/utils/timeZone';
import './CuratedPosts.css';

export default function RedditPosts({ items, offsetMinutes, loading }: { items: NewsItem[]; offsetMinutes: number; loading: boolean }) {
  const { t } = useTranslation();
  return (
    <section className="curated-posts" aria-label={t('newsSocial')} aria-busy={loading}>
      {items.map((post, index) => (
        <article className="curated-post" key={post.id}>
          <span className="curated-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
          <div>
            <div className="curated-meta"><span>Reddit · r/formula1</span>
              <time dateTime={post.publishedAt}>{formatNewsTimestamp(post.publishedAt, offsetMinutes)} {formatUtcOffset(offsetMinutes)}</time>
            </div>
            <h3><a href={post.url} target="_blank" rel="noopener noreferrer">{post.title} <span aria-hidden="true">↗</span></a></h3>
            <a className="curated-read" href={post.url} target="_blank" rel="noopener noreferrer">{t('newsOpenPost')} <span aria-hidden="true">↗</span></a>
          </div>
        </article>
      ))}
    </section>
  );
}
