import { Button, Card, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  QualifyingResult,
  RacePreviewSummary,
  RecentGrandPrixResult,
  Result,
  TrackInterruptionProbability,
  TrackInterruptionSample,
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

  const metrics = useMemo(() => {
    const interruptions = summary?.interruptionProbabilities || [];
    const averageRisk = interruptions.length
      ? interruptions.reduce((total, item) => total + (item.probabilityPct || 0), 0) / interruptions.length
      : null;
    return [
      { label: t('historicalRaces'), value: String(summary?.sampleSize || 0), detail: t('sampleSize') },
      { label: t('poleConversion'), value: formatProbability(summary?.poleWinConversionPct), detail: t('pole') },
      { label: t('interruptionRisk'), value: formatProbability(averageRisk), detail: interruptions.map((item) => item.type).join(' / ') || '-' },
    ];
  }, [summary, t]);

  const recentColumns = useMemo<ColumnsType<RecentGrandPrixResult>>(() => [
    {
      title: t('time'), key: 'season', width: 116,
      render: (_: unknown, record) => (
        <div className="race-history-time-cell"><strong>{record.season}</strong><span>{formatShortDate(record.date)}</span></div>
      ),
    },
    {
      title: t('winner'), key: 'winner', width: 200,
      render: (_: unknown, record) => {
        const info = record.winnerDriverId ? driverInfo.get(record.winnerDriverId) : null;
        const color = getTeamColor(record.winnerConstructorId || info?.constructorId || '') || DEFAULT_TAG_COLOR;
        const code = info?.code || (record.winnerDriverId ? driverIdToCode(record.winnerDriverId) : '');
        return <span style={driverTagStyle(color)}>{code || record.winnerName || '-'}</span>;
      },
    },
    {
      title: t('pole'), key: 'pole', width: 160,
      render: (_: unknown, record) => {
        const info = record.poleDriverId ? driverInfo.get(record.poleDriverId) : null;
        if (!info) return <strong>{record.poleName || '-'}</strong>;
        const color = info.constructorId ? getTeamColor(info.constructorId) : DEFAULT_TAG_COLOR;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ ...driverTagStyle(color), minWidth: 36 }}>{info.code}</span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>P1</span>
          </div>
        );
      },
    },
    {
      title: t('podium'), key: 'podium',
      render: (_: unknown, record) => record.podium.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {record.podium.map((item) => {
            const info = driverInfo.get(item.driverId);
            const color = getTeamColor(item.constructorId || info?.constructorId || '') || DEFAULT_TAG_COLOR;
            return (
              <span key={item.position} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>P{item.position}</span>
                <span style={driverTagStyle(color, true)}>{info?.code || driverIdToCode(item.driverId)}</span>
              </span>
            );
          })}
        </div>
      ) : '-',
    },
  ], [driverInfo, t]);

  const interruptionColumns = useMemo<ColumnsType<TrackInterruptionProbability>>(() => [
    { title: t('raceStatus'), dataIndex: 'label', key: 'label', width: 160 },
    { title: t('probability'), key: 'probability', width: 120, render: (_: unknown, record) => <strong>{formatProbability(record.probabilityPct)}</strong> },
    {
      title: t('sampleSize'), key: 'sampleSize', width: 140,
      render: (_: unknown, record) => (
        <span>{record.triggeredCount}/{record.sampleSize}{record.status === 'insufficient-data' ? ` ${t('insufficientData')}` : ''}</span>
      ),
    },
  ], [t]);
  const sampleColumns = useMemo<ColumnsType<TrackInterruptionSample>>(() => [
    { title: t('season'), key: 'season', width: 92, render: (_: unknown, record) => <strong>{record.season}</strong> },
    { title: t('race'), key: 'race', render: (_: unknown, record) => <span>{record.raceName} R{record.round}</span> },
    {
      title: t('raceStatus'), key: 'statusTypes', width: 240,
      render: (_: unknown, record) => (
        <div className="race-weekend-status-tags">
          {record.statusLabels.length
            ? record.statusLabels.map((label, index) => <Tag key={`${record.season}-${record.statusTypes[index]}`}>{label}</Tag>)
            : <Tag>{t('noInterruption')}</Tag>}
        </div>
      ),
    },
  ], [t]);

  return (
    <section className="race-info-section" aria-labelledby="race-context-heading">
      <div className="race-info-section-heading">
        <span id="race-context-heading">{t('recentWinners')}</span><small>{t('preRaceDescription')}</small>
      </div>
      <div className="race-weekend-grid race-info-secondary-grid">
        <Card className="race-weekend-card" loading={loading}>
          {error ? (
            <div className="race-weekend-empty" role="alert">
              <span>{error.message}</span>
              <Button onClick={onRetry}>重试历史样本</Button>
            </div>
          ) : (
            <>
              <div className="race-weekend-metric-grid">
                {metrics.map((item) => (
                  <span key={item.label} className="race-weekend-metric">
                    <small>{item.label}</small><strong>{item.value}</strong><em>{item.detail}</em>
                  </span>
                ))}
              </div>
              {summary?.recentResults.length ? (
                <ViewportTable
                  className="race-history-table" columns={recentColumns} dataSource={summary.recentResults}
                  rowKey={(record) => record.raceId} pagination={false} size="small" scroll={{ x: 'max-content' }}
                />
              ) : <div className="race-weekend-empty">{t('noPreviewData')}</div>}
            </>
          )}
        </Card>

        {predictionsEnabled && !error ? (
          <Card className="race-weekend-card" loading={loading} title={<div className="data-view-title"><span>{t('interruptionRisk')}</span></div>}>
            <div className="race-weekend-risk-grid">
              {(summary?.interruptionProbabilities || []).map((item) => (
                <span key={item.type} className={`race-weekend-risk-item risk-${item.type.toLowerCase()}`}>
                  <small>{item.label}</small><strong>{formatProbability(item.probabilityPct)}</strong>
                  <em>{item.triggeredCount}/{item.sampleSize}{item.status === 'insufficient-data' ? ` ${t('insufficientData')}` : ''}</em>
                </span>
              ))}
            </div>
            <ViewportTable columns={interruptionColumns} dataSource={summary?.interruptionProbabilities || []} rowKey={(record) => record.type} pagination={false} size="small" />
            <div className="race-weekend-subtable" style={{ marginTop: 12 }}>
              <h4 style={{ marginBottom: 8 }}>{t('sampleYears')}</h4>
              <ViewportTable columns={sampleColumns} dataSource={summary?.interruptionSamples || []} rowKey={(record) => `${record.season}-${record.round}`} pagination={false} size="small" scroll={{ x: 'max-content' }} />
            </div>
          </Card>
        ) : null}
      </div>
    </section>
  );
}
