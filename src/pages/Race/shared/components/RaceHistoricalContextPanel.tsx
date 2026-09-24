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
import { DEFAULT_TAG_COLOR, LIGHT_TAG_COLORS } from '@/pages/Race/shared/constants';
import ViewportTable from '@/pages/Race/shared/components/ViewportTable';
import { formatProbability, formatShortDate } from '@/utils/raceDetailFormatters';
import { getTeamColor } from '@/utils/teamColors';

interface DriverInfo {
  code: string;
  constructorId: string;
}

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

function driverIdToCode(driverId: string): string {
  const parts = driverId.split('_').filter(Boolean);
  return (parts[parts.length - 1] || driverId).slice(0, 3).toUpperCase();
}

function driverTagStyle(color: string, small = false) {
  return {
    display: 'inline-block',
    backgroundColor: color,
    color: LIGHT_TAG_COLORS.has(color) ? '#111827' : '#fff',
    fontWeight: 700,
    fontSize: small ? 11 : 12,
    padding: small ? '1px 5px' : '2px 6px',
    borderRadius: 3,
    textAlign: 'center' as const,
  };
}

export function RaceHistoricalContextPanel({
  summary,
  loading,
  error,
  onRetry,
  predictionsEnabled,
  raceResults,
  qualifyingResults,
  sprintResults,
}: RaceHistoricalContextPanelProps) {
  const { t } = useTranslation();
  const driverInfo = useMemo(() => {
    const map = new Map<string, DriverInfo>();
    [...raceResults, ...qualifyingResults, ...sprintResults].forEach((result) => {
      if (result.Driver?.driverId && result.Driver?.code) {
        map.set(result.Driver.driverId, {
          code: result.Driver.code,
          constructorId: result.Constructor?.constructorId || '',
        });
      }
    });
    (summary?.recentResults || []).forEach((item) => {
      const add = (driverId: string | null, constructorId = '') => {
        if (driverId && !map.has(driverId)) {
          map.set(driverId, { code: driverIdToCode(driverId), constructorId });
        }
      };
      add(item.winnerDriverId, item.winnerConstructorId || '');
      add(item.poleDriverId);
      item.podium.forEach((podium) => add(podium.driverId, podium.constructorId || ''));
    });
    return map;
  }, [qualifyingResults, raceResults, sprintResults, summary]);

  const recentColumns = useMemo<ColumnsType<RecentGrandPrixResult>>(() => [
    {
      title: t('time'), key: 'season', width: 105, className: 'history-cell-year',
      render: (_: unknown, record) => (
        <div className="race-history-time-cell"><strong>{record.season}</strong><span>{formatShortDate(record.date)}</span></div>
      ),
    },
    {
      title: t('winner'), key: 'winner', width: 180,
      onCell: () => ({ className: 'history-cell-winner', 'data-label': t('winner') }),
      render: (_: unknown, record) => {
        const info = record.winnerDriverId ? driverInfo.get(record.winnerDriverId) : null;
        const color = getTeamColor(record.winnerConstructorId || info?.constructorId || '') || DEFAULT_TAG_COLOR;
        const code = info?.code || (record.winnerDriverId ? driverIdToCode(record.winnerDriverId) : '');
        return <div className="history-winner"><span title={record.winnerName || undefined} style={driverTagStyle(color)}>{code || record.winnerName || '-'}</span><span className="history-winner-name">{record.winnerName}</span></div>;
      },
    },
    {
      title: t('pole'), key: 'pole', width: 88,
      onCell: () => ({ className: 'history-cell-pole', 'data-label': t('pole') }),
      render: (_: unknown, record) => {
        const info = record.poleDriverId ? driverInfo.get(record.poleDriverId) : null;
        if (!info) return <strong>{record.poleName || '-'}</strong>;
        const color = info.constructorId ? getTeamColor(info.constructorId) : DEFAULT_TAG_COLOR;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span title={record.poleName || undefined} style={{ ...driverTagStyle(color), minWidth: 36 }}>{info.code}</span>
          </div>
        );
      },
    },
    {
      title: t('podium'), key: 'podium',
      onCell: () => ({ className: 'history-cell-podium', 'data-label': t('podium') }),
      render: (_: unknown, record) => record.podium.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {record.podium.map((item) => {
            const info = driverInfo.get(item.driverId);
            const color = getTeamColor(item.constructorId || info?.constructorId || '') || DEFAULT_TAG_COLOR;
            return (
              <span key={item.position} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>P{item.position}</span>
                <span title={item.driverName} style={driverTagStyle(color, true)}>{info?.code || driverIdToCode(item.driverId)}</span>
              </span>
            );
          })}
        </div>
      ) : '-',
    },
  ], [driverInfo, t]);

  return (
    <section className="race-info-section race-history-brief" aria-labelledby="race-context-heading">
      <div className="race-info-section-heading">
        <span id="race-context-heading">{t('recentWinners')}</span><small>{t('historyBriefDescription')}</small>
      </div>
      <div className="race-info-secondary-grid">
        {loading ? <Card loading className="history-loading" /> : error ? (
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
                    rowKey={(record) => record.raceId} pagination={false} size="small" scroll={{ x: 520 }}
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
