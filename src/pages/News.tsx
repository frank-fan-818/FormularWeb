import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import RedditPosts from '@/components/news/RedditPosts';
import DocumentHead from '@/components/DocumentHead';
import ProductMasthead from '@/components/product/ProductMasthead';
import { TimingBeacon } from '@/components/loading/TimingBeacon';
import { NEWS_SOURCES } from '@/data/newsSources';
import { useNews } from '@/hooks/useNews';
import { useTranslation } from '@/i18n';
import { useAppStore } from '@/store';
import type { NewsKind } from '@/types/news';
import { filterNewsItems, formatNewsTimestamp } from '@/utils/news';
import { formatUtcOffset } from '@/utils/timeZone';
import './News.css';

const PAGE_SIZE = 15;
const FILTERS = ['all', 'news', 'official', 'social'] as const;
const KIND_KEYS = { all: 'newsAll', news: 'newsReports', official: 'newsOfficial', social: 'newsSocial' };

export default function News() {
  const { t } = useTranslation();
  const offset = useAppStore(state => state.timeZoneOffsetMinutes);
  const { items, sources, loading, error, refresh } = useNews();
  const [params, setParams] = useSearchParams();
  const category = params.get('category');
  const kind: NewsKind | 'all' = category === 'social' || category === 'official' || category === 'news' ? category : 'all';
  const setKind = (value: NewsKind | 'all') => {
    const next = new URLSearchParams(params);
    if (value === 'all') next.delete('category'); else next.set('category', value);
    setParams(next);
  };
  const [sourceId, setSourceId] = useState('all');
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const filtered = useMemo(() => filterNewsItems(items, { kind, sourceId, query }), [items, kind, sourceId, query]);
  const relevantSources = sources.filter(state => {
    const source = NEWS_SOURCES.find(item => item.id === state.sourceId)!;
    return (sourceId === 'all' || sourceId === state.sourceId) && (kind === 'all' || source.kind === kind);
  });
  const sourcesLoading = loading && relevantSources.some(source => source.refreshing || source.status === 'loading');
  const unavailableSources = relevantSources.filter(source => !source.refreshing && (source.status === 'stale' || source.status === 'error'));
  const allFailed = error || (relevantSources.length > 0 && relevantSources.every(source => source.status === 'error'));
  const emptyTitle = allFailed ? t('newsUnavailable') : t('newsEmpty');

  return (
    <div className="news-page">
      <DocumentHead title={`${t('newsTitle')} — F1 Dashboard`} description={t('newsDescription')} />
      <ProductMasthead
        title="PADDOCK JOURNAL"
        description={t('newsDescription')}
        className="news-masthead"
        actions={(
          <button type="button" className="news-refresh" onClick={refresh} disabled={loading}>
            <span aria-hidden="true">↻</span>{loading ? t('newsRefreshing') : t('newsRefresh')}
          </button>
        )}
      />

      <div className="news-workspace">
        <section className="news-main" aria-label={t('newsHeadlines')}>
          <div className="news-toolbar">
            <div className="news-filters" role="group" aria-label={t('newsCategory')}>
              {FILTERS.map(value => (
                <button key={value} type="button" aria-pressed={kind === value}
                  onClick={() => { setKind(value); setSourceId('all'); setVisibleCount(PAGE_SIZE); }}>
                  {t(KIND_KEYS[value])}
                </button>
              ))}
            </div>
            <div className="news-search-controls">
              <label className="news-search">
                <span className="news-control-label">{t('newsSearch')}</span>
                <svg className="news-search-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" focusable="false">
                  <circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" />
                </svg>
                <input type="search" value={query} placeholder={t('newsSearchPlaceholder')}
                  onChange={event => { setQuery(event.target.value); setVisibleCount(PAGE_SIZE); }} />
              </label>
              {kind !== 'social' ? <label className="news-source-select">
                <span className="news-control-label">{t('newsSource')}</span>
                <select value={sourceId} onChange={event => { setSourceId(event.target.value); setVisibleCount(PAGE_SIZE); }}>
                  <option value="all">{t('newsAllSources')}</option>
                  {NEWS_SOURCES.filter(source => kind === 'all' || source.kind === kind).map(source => <option key={source.id} value={source.id}>{source.name}</option>)}
                </select>
              </label> : null}
            </div>
          </div>

          {unavailableSources.length > 0 && !allFailed ? (
            <div className="news-notice" role="status">
              {t('newsPartial', { sources: unavailableSources.map(state => NEWS_SOURCES.find(source => source.id === state.sourceId)!.name).join(' / ') })}
            </div>
          ) : null}

          <div className={`news-result-heading${kind === 'social' ? ' news-result-heading--social' : ''}`}>
            {kind !== 'social' ? <>
              <span>{t('newsLatest')}</span>
              <span role="status" aria-live="polite">{t('newsResultCount', { count: filtered.length })}</span>
            </> : null}
            <button type="button" className="news-refresh news-refresh--compact" onClick={refresh} disabled={loading}>
              <span aria-hidden="true">↻</span>{loading ? t('newsRefreshing') : t('newsRefresh')}
            </button>
          </div>

          {sourcesLoading && filtered.length === 0 ? (
            <div className="news-state" role="status"><TimingBeacon label={t('newsLoading')} detail={t('newsLoadingDetail')} /></div>
          ) : filtered.length === 0 ? (
            <div className="news-state">
              <span className="news-state-mark" aria-hidden="true">{allFailed ? '!' : '—'}</span>
              <h2>{emptyTitle}</h2>
              <p>{allFailed ? t('newsUnavailableDetail') : t('newsEmptyDetail')}</p>
              {allFailed ? <button type="button" className="news-refresh" onClick={refresh} disabled={loading}>{t('newsRetry')}</button> : null}
            </div>
          ) : kind === 'social' ? (
            <RedditPosts items={filtered.slice(0, visibleCount)} offsetMinutes={offset} loading={loading} />
          ) : (
            <div className="news-list" aria-busy={loading}>
              {filtered.slice(0, visibleCount).map((item, index) => (
                <article key={item.id} className={`news-entry${index === 0 ? ' news-entry--lead' : ''}`}>
                  <span className="news-entry-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                  <div className="news-entry-copy">
                    <div className="news-entry-meta">
                      <span className={`news-kind news-kind--${item.kind}`}>{t(KIND_KEYS[item.kind])}</span>
                      <span className="news-source-name">{NEWS_SOURCES.find(source => source.id === item.sourceId)!.name}</span>
                    </div>
                    <h2><a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}<span className="news-entry-arrow" aria-hidden="true">↗</span></a></h2>
                    <div className="news-entry-footer">
                      <time dateTime={item.publishedAt}>{formatNewsTimestamp(item.publishedAt, offset)} <span>{formatUtcOffset(offset)}</span></time>
                      <a href={item.url} target="_blank" rel="noopener noreferrer">{t('newsReadOriginal')} <span aria-hidden="true">↗</span></a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {filtered.length > visibleCount ? (
            <button type="button" className="news-load-more" onClick={() => setVisibleCount(count => count + PAGE_SIZE)}>{t('newsLoadMore')}</button>
          ) : null}
        </section>
      </div>
    </div>
  );
}
