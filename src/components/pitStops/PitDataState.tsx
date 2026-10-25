import { usePitTranslation } from '@/hooks/usePitTranslation';

interface Props { loading: boolean; error: boolean; empty: boolean; stale?: boolean; pending?: boolean; onRetry: () => void }
export function PitDataState({ loading, error, empty, stale, pending, onRetry }: Props) {
  const { t } = usePitTranslation();
  if (loading && empty) return <div className="pit-state" role="status"><span className="loading-indicator" aria-hidden="true" />{t('pitLoading')}</div>;
  if (error || stale) return <div className="pit-state" role="status"><span>{t(empty ? 'pitFailed' : 'pitStale')}</span><button type="button" onClick={onRetry} disabled={loading}>{t('pitRetry')}</button></div>;
  if (empty) return <div className="pit-state" role="status">{t(pending ? 'pitAfterRace' : 'pitEmpty')}</div>;
  return null;
}
