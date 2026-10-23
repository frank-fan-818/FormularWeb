import { Button, Card, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo } from 'react';
import { useTranslation } from '@/i18n';
import type {
  QualifyingResult,
  RacePreviewSummary,
  RecentGrandPrixResult,
  Result,
} from '@/types';
import ViewportTable from '@/pages/Race/shared/components/ViewportTable';
import { formatProbability, formatShortDate } from '@/utils/raceDetailFormatters';
import { TimingBeacon } from '@/components/loading/TimingBeacon';

interface RaceHistoricalContextPanelProps {
  summary: RacePreviewSummary | null;
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  predictionsEnabled: boolean;
  raceResults: Result[];
  qualifyingResults: QualifyingResult[];
  sprintResults: Result[];
}

export function RaceHistoricalContextPanel({
  summary,
  loading,
  error,
  onRetry,
  predictionsEnabled,
}: RaceHistoricalContextPanelProps) {
  const { t } = useTranslation();

  const recentColumns = useMemo<ColumnsType<RecentGrandPrixResult>>(() => [
    {
      title: t('time'), key: 'season', width: 105, className: 'history-cell-year',
      render: (_: unknown, record) => (
        <div className="race-history-time-cell"><strong>{record.season}</strong><span>{formatShortDate(record.date)}</span></div>
      ),
    },
    {
      title: t('winner'), key: 'winner',
      onCell: () => ({ className: 'history-cell-winner', 'data-label': t('winner') }),
      render: (_: unknown, record) => <span className="history-driver-name">{record.winnerName || '-'}</span>,
    },
    {
      title: t('pole'), key: 'pole',
      onCell: () => ({ className: 'history-cell-pole', 'data-label': t('pole') }),
      render: (_: unknown, record) => <span className="history-driver-name">{record.poleName || '-'}</span>,
    },
    {
      title: t('podium'), key: 'podium',
      onCell: () => ({ className: 'history-cell-podium', 'data-label': t('podium') }),
      render: (_: unknown, record) => record.podium.length ? (
        <div className="history-podium">
          {record.podium.map((item) => (
            <span key={item.position} className="history-podium-driver">
              <span className="history-podium-position">P{item.position}</span>
              <span className="history-driver-name">{item.driverName}</span>
            </span>
          ))}
        </div>
      ) : '-',
    },
  ], [t]);

  return (
    <section className="race-info-section race-history-brief" aria-labelledby="race-context-heading">
      <div className="race-info-section-heading">
        <span id="race-context-heading">{t('recentWinners')}</span><small>{t('historyBriefDescription')}</small>
      </div>
      <div className="race-info-secondary-grid">
        {loading ? <Card className="history-loading"><TimingBeacon variant="inline" label={`正在加载${t('recentWinners')}`} /></Card> : error ? (
          <div className="race-weekend-empty" role="alert">
            <span>{error.message}</span><Button onClick={onRetry}>{t('retryHistory')}</Button>
          </div>
        ) : (
          <div className="history-brief-surface">
            <div className={`history-brief-grid${predictionsEnabled ? '' : ' history-brief-grid--results-only'}`}>
              <div className="history-results">
                <div className="history-stats">
                  <div><span>{t('historicalRaces')}</span><strong>{summary?.sampleSize || 0}</strong></div>
                  <div><span>{t('poleConversion')}</span><strong>{formatProbability(summary?.poleWinConversionPct)}</strong></div>
                </div>
                {summary?.recentResults.length ? (
                  <ViewportTable
                    className="history-results-table" columns={recentColumns} dataSource={summary.recentResults}
                    rowKey={(record) => record.raceId} pagination={false} size="small" tableLayout="fixed"
                  />
                ) : <div className="race-weekend-empty">{t('noPreviewData')}</div>}
              </div>
              {predictionsEnabled ? (
                <aside className="history-risk" aria-labelledby="history-risk-heading">
                  <h3 id="history-risk-heading">{t('historicalTrackStatus')}</h3>
                  <p>{t('historyRiskDescription')}</p>
                  <div className="history-risk-list">
                    {(summary?.interruptionProbabilities || []).map((item) => (
                      <div key={item.type} className={`history-risk-row risk-${item.type.toLowerCase()}`}>
                        <div className="history-risk-label"><span>{item.label}</span><strong>{formatProbability(item.probabilityPct)}</strong></div>
                        <div className="history-risk-track" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, item.probabilityPct ?? 0))}%` }} /></div>
                        <small>{t('historyOccurrence', { count: item.triggeredCount, total: item.sampleSize })}{item.status === 'insufficient-data' ? ` · ${t('insufficientData')}` : ''}</small>
                      </div>
                    ))}
                    {!summary?.interruptionProbabilities.length ? <div className="race-weekend-empty">{t('noPreviewData')}</div> : null}
                  </div>
                </aside>
              ) : null}
            </div>
            {predictionsEnabled ? (
              <details className="history-samples">
                <summary><span>{t('sampleYears')}<small>{summary?.interruptionSamples.length || 0}</small></span><span className="history-samples-toggle" aria-hidden="true">+</span></summary>
                <div className="history-samples-list">
                  {(summary?.interruptionSamples || []).map((sample) => (
                    <div className="history-sample" key={`${sample.season}-${sample.round}`}>
                      <strong>{sample.season}<small>R{sample.round}</small></strong>
                      <span className="history-sample-name">{sample.raceName}</span>
                      <div className="history-sample-tags">
                        {sample.statusLabels.length ? sample.statusLabels.map((label, index) => (
                          <Tag key={label} className={`risk-${sample.statusTypes[index]?.toLowerCase()}`}>{label}</Tag>
                        )) : <span>{t('noInterruption')}</span>}
                      </div>
                    </div>
                  ))}
                  {!summary?.interruptionSamples.length ? <div className="race-weekend-empty">{t('noPreviewData')}</div> : null}
                </div>
              </details>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
