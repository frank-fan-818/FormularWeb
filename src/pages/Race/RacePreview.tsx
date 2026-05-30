import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type {
  RecentGrandPrixResult,
  TrackInterruptionProbability,
  TrackInterruptionSample,
} from '@/types';
import type { FiaRaceUpgradeTeamSummary } from '@/api/fiaCarUpgrades';
import { getTeamColor } from '@/utils/teamColors';
import { isFeatureEnabled } from '@/utils/featureFlags';
import {
  formatProbability,
  formatShortDate,
} from '@/utils/raceDetailFormatters';
import {
  UPGRADE_REASON_LABELS,
  LIGHT_TAG_COLORS,
  DEFAULT_TAG_COLOR,
} from '@/pages/RaceDetail/constants';
import { TableOnlyPanel } from '@/pages/RaceDetail/components/DataViewPanels';
import { useRaceData } from './RaceContext';
import '../RaceDetail.css';

function driverIdToCode(driverId: string): string {
  const parts = driverId.split('_').filter(Boolean);
  const last = parts[parts.length - 1] || driverId;
  return last.slice(0, 3).toUpperCase();
}

const RacePreview = () => {
  const { t } = useTranslation();
  const {
    raceResults,
    qualifyingResults,
    sprintResults,
    racePreviewSummary,
    racePreviewLoading,
    raceUpgradeSummary,
    raceUpgradeLoading,
    raceUpgradeError,
  } = useRaceData();

  // ---- Driver info lookup ----

  const driverInfoByDriverId = useMemo(() => {
    const map = new Map<string, { code: string; constructorId: string; constructorName: string }>();
    // From current race results (may be empty in pre-race mode)
    [...raceResults, ...qualifyingResults, ...sprintResults].forEach((r) => {
      if (r.Driver?.driverId && r.Driver?.code) {
        map.set(r.Driver.driverId, {
          code: r.Driver.code,
          constructorId: r.Constructor?.constructorId || '',
          constructorName: r.Constructor?.name || '',
        });
      }
    });
    // From recent historical results (always available pre and post race)
    (racePreviewSummary?.recentResults || []).forEach((item) => {
      if (item.winnerDriverId && item.winnerName && !map.has(item.winnerDriverId)) {
        map.set(item.winnerDriverId, {
          code: driverIdToCode(item.winnerDriverId),
          constructorId: item.winnerConstructorId || '',
          constructorName: item.winnerConstructorName || '',
        });
      }
      if (item.poleDriverId && item.poleName && !map.has(item.poleDriverId)) {
        map.set(item.poleDriverId, {
          code: driverIdToCode(item.poleDriverId),
          constructorId: '',
          constructorName: '',
        });
      }
      (item.podium || []).forEach((p) => {
        if (p.driverId && !map.has(p.driverId)) {
          map.set(p.driverId, {
            code: driverIdToCode(p.driverId),
            constructorId: p.constructorId || '',
            constructorName: p.constructorName || '',
          });
        }
      });
    });
    return map;
  }, [raceResults, qualifyingResults, sprintResults, racePreviewSummary]);

  // Feature flag checks
  const predictionsEnabled = isFeatureEnabled('race-predictions');

  // ---- Recent winners columns ----

  const recentResultColumns: ColumnsType<RecentGrandPrixResult> = [
    {
      title: t('time'),
      key: 'season',
      width: 116,
      render: (_: unknown, record: RecentGrandPrixResult) => (
        <div className="race-history-time-cell">
          <strong>{record.season}</strong>
          <span>{formatShortDate(record.date)}</span>
        </div>
      ),
    },
    {
      title: t('winner'),
      key: 'winner',
      width: 200,
      render: (_: unknown, record: RecentGrandPrixResult) => {
        const info = record.winnerDriverId ? driverInfoByDriverId.get(record.winnerDriverId) : null;
        const color = record.winnerConstructorId
          ? getTeamColor(record.winnerConstructorId)
          : (info?.constructorId ? getTeamColor(info.constructorId) : DEFAULT_TAG_COLOR);
        const code = info?.code || (record.winnerDriverId ? driverIdToCode(record.winnerDriverId) : '');
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                display: 'inline-block',
                backgroundColor: color,
                color: LIGHT_TAG_COLORS.has(color) ? '#111827' : '#fff',
                fontWeight: 700,
                fontSize: 12,
                padding: '2px 6px',
                borderRadius: 3,
                textAlign: 'center',
              }}
            >
              {code || record.winnerName || '-'}
            </span>
          </div>
        );
      },
    },
    {
      title: t('pole'),
      key: 'pole',
      width: 160,
      render: (_: unknown, record: RecentGrandPrixResult) => {
        const info = record.poleDriverId ? driverInfoByDriverId.get(record.poleDriverId) : null;
        if (!info) {
          return <strong>{record.poleName || '-'}</strong>;
        }
        const color = info.constructorId ? getTeamColor(info.constructorId) : DEFAULT_TAG_COLOR;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              display: 'inline-block',
              backgroundColor: color,
              color: LIGHT_TAG_COLORS.has(color) ? '#111827' : '#fff',
              fontWeight: 700, fontSize: 12,
              padding: '2px 6px', borderRadius: 3,
              textAlign: 'center', minWidth: 36,
            }}>
              {info.code}
            </span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>P1</span>
          </div>
        );
      },
    },
    {
      title: t('podium'),
      key: 'podium',
      render: (_: unknown, record: RecentGrandPrixResult) => {
        if (!record.podium.length) return '-';
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {record.podium.map((item) => {
              const info = driverInfoByDriverId.get(item.driverId);
              const code = info?.code || driverIdToCode(item.driverId);
              const color = item.constructorId
                ? getTeamColor(item.constructorId)
                : (info?.constructorId ? getTeamColor(info.constructorId) : DEFAULT_TAG_COLOR);
              return (
                <span key={item.position} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>P{item.position}</span>
                  <span style={{
                    display: 'inline-block',
                    backgroundColor: color,
                    color: LIGHT_TAG_COLORS.has(color) ? '#111827' : '#fff',
                    fontWeight: 700, fontSize: 11,
                    padding: '1px 5px', borderRadius: 3,
                    textAlign: 'center',
                  }}>
                    {code}
                  </span>
                </span>
              );
            })}
          </div>
        );
      },
    },
  ];

  // ---- Interruption risk columns ----

  const interruptionColumns: ColumnsType<TrackInterruptionProbability> = [
    {
      title: t('raceStatus'),
      dataIndex: 'label',
      key: 'label',
      width: 160,
    },
    {
      title: t('probability'),
      key: 'probability',
      width: 120,
      render: (_: unknown, record: TrackInterruptionProbability) => (
        <strong>{formatProbability(record.probabilityPct)}</strong>
      ),
    },
    {
      title: t('sampleSize'),
      key: 'sampleSize',
      width: 140,
      render: (_: unknown, record: TrackInterruptionProbability) => (
        <span>
          {record.triggeredCount}
          /
          {record.sampleSize}
          {record.status === 'insufficient-data' ? ` ${t('insufficientData')}` : ''}
        </span>
      ),
    },
  ];

  const interruptionSampleColumns: ColumnsType<TrackInterruptionSample> = [
    {
      title: t('season'),
      key: 'season',
      width: 92,
      render: (_: unknown, record: TrackInterruptionSample) => (
        <strong>{record.season}</strong>
      ),
    },
    {
      title: t('race'),
      key: 'race',
      render: (_: unknown, record: TrackInterruptionSample) => (
        <span>
          {record.raceName}
          {' '}
          R
          {record.round}
        </span>
      ),
    },
    {
      title: t('raceStatus'),
      key: 'statusTypes',
      width: 240,
      render: (_: unknown, record: TrackInterruptionSample) => (
        <div className="race-weekend-status-tags">
          {record.statusLabels.length ? record.statusLabels.map((label, index) => (
            <Tag key={`${record.season}-${record.statusTypes[index]}`} color="default">
              {label}
            </Tag>
          )) : (
            <Tag>{t('noInterruption')}</Tag>
          )}
        </div>
      ),
    },
  ];

  // ---- FIA upgrades columns ----

  const raceUpgradeColumns: ColumnsType<FiaRaceUpgradeTeamSummary> = [
    {
      title: t('constructor'),
      dataIndex: 'team',
      key: 'team',
      fixed: 'left' as const,
      width: 150,
      render: (team: string) => <strong className="upgrade-team-name">{team}</strong>,
    },
    {
      title: t('upgradeTotal'),
      dataIndex: 'declaredUpgradeCount',
      key: 'declaredUpgradeCount',
      width: 96,
      sorter: (a, b) => a.declaredUpgradeCount - b.declaredUpgradeCount,
    },
    {
      title: t('upgradeIntensity'),
      dataIndex: 'declaredUpgradeIntensity',
      key: 'declaredUpgradeIntensity',
      width: 96,
      sorter: (a, b) => a.declaredUpgradeIntensity - b.declaredUpgradeIntensity,
      render: (value: number, record) => (
        <span className={`upgrade-intensity-pill upgrade-intensity-${record.maxComponentImportance >= 4 ? 'high' : 'normal'}`}>
          {value}
        </span>
      ),
    },
    {
      title: t('upgradeIntent'),
      key: 'dominantReason',
      width: 120,
      render: (_: unknown, record) => (
        <Tag color={record.dominantReason === 'Performance' ? 'red' : 'blue'}>
          {UPGRADE_REASON_LABELS[record.dominantReason]}
        </Tag>
      ),
    },
    {
      title: t('upgradeComponents'),
      key: 'componentNames',
      render: (_: unknown, record) => (
        <div className="upgrade-component-tags">
          {record.componentNames.length ? record.componentNames.map((component) => (
            <span key={`${record.team}-${component}`}>{component}</span>
          )) : '-'}
        </div>
      ),
    },
    {
      title: t('upgradeSource'),
      key: 'source',
      width: 120,
      render: (_: unknown, record) => record.documentUrl ? (
        <a href={record.documentUrl} target="_blank" rel="noreferrer">
          FIA
        </a>
      ) : 'FIA',
    },
  ];

  // ---- Metrics ----

  const racePreviewMetrics = useMemo(() => {
    const interruptionItems = racePreviewSummary?.interruptionProbabilities || [];
    const averageInterruptionRisk = interruptionItems.length
      ? interruptionItems.reduce((total, item) => total + (item.probabilityPct || 0), 0) / interruptionItems.length
      : null;

    return [
      { label: t('historicalRaces'), value: String(racePreviewSummary?.sampleSize || 0), detail: t('sampleSize') },
      { label: t('poleConversion'), value: formatProbability(racePreviewSummary?.poleWinConversionPct), detail: t('pole') },
      { label: t('interruptionRisk'), value: formatProbability(averageInterruptionRisk), detail: interruptionItems.map((item) => item.type).join(' / ') || '-' },
    ];
  }, [racePreviewSummary]);

  const raceUpgradeMetrics = useMemo(() => [
    {
      label: t('upgradeTotal'),
      value: String(raceUpgradeSummary?.totalDeclaredUpgradeCount || 0),
      detail: raceUpgradeSummary?.grandPrix || '-',
    },
    {
      label: t('upgradeIntensity'),
      value: String(raceUpgradeSummary?.totalDeclaredUpgradeIntensity || 0),
      detail: raceUpgradeSummary?.source || '-',
    },
    {
      label: t('upgradeTeams'),
      value: String(raceUpgradeSummary?.teams.length || 0),
      detail: raceUpgradeSummary?.sourceDocuments[0]?.title || '-',
    },
  ], [raceUpgradeSummary]);

  // ---- Render ----

  return (
    <div className="race-preview-page race-weekend-grid race-preview-grid">
      {/* Recent Winners */}
      <TableOnlyPanel
        title={t('recentWinners')}
        description={t('preRaceDescription')}
        loading={racePreviewLoading}
        collapsed={false}
        onToggleCollapse={() => {}}
      >
        <>
          <div className="race-weekend-metric-grid">
            {racePreviewMetrics.map((item) => (
              <span key={item.label} className="race-weekend-metric">
                <small>{item.label}</small>
                <strong>{item.value}</strong>
                <em>{item.detail}</em>
              </span>
            ))}
          </div>
          {racePreviewSummary?.recentResults.length ? (
            <Table
              className="race-history-table"
              columns={recentResultColumns}
              dataSource={racePreviewSummary.recentResults}
              rowKey={(record) => record.raceId}
              pagination={false}
              size="small"
              scroll={{ x: 'max-content' }}
            />
          ) : (
            <div className="race-weekend-empty">{t('noPreviewData')}</div>
          )}
        </>
      </TableOnlyPanel>

      {/* Interruption Risk */}
      {predictionsEnabled ? <TableOnlyPanel
        title={t('interruptionRisk')}
        loading={racePreviewLoading}
        collapsed={false}
        onToggleCollapse={() => {}}
      >
        <>
          <div className="race-weekend-risk-grid">
            {(racePreviewSummary?.interruptionProbabilities || []).map((item) => (
              <span key={item.type} className={`race-weekend-risk-item risk-${item.type.toLowerCase()}`}>
                <small>{item.label}</small>
                <strong>{formatProbability(item.probabilityPct)}</strong>
                <em>
                  {item.triggeredCount}
                  /
                  {item.sampleSize}
                  {item.status === 'insufficient-data' ? ` ${t('insufficientData')}` : ''}
                </em>
              </span>
            ))}
          </div>
          <Table
            columns={interruptionColumns}
            dataSource={racePreviewSummary?.interruptionProbabilities || []}
            rowKey={(record) => record.type}
            pagination={false}
            size="small"
          />
          <div className="race-weekend-subtable">
            <h4>{t('sampleYears')}</h4>
            <Table
              columns={interruptionSampleColumns}
              dataSource={racePreviewSummary?.interruptionSamples || []}
              rowKey={(record) => `${record.season}-${record.round}`}
              pagination={false}
              size="small"
              scroll={{ x: 'max-content' }}
            />
          </div>
        </>
      </TableOnlyPanel> : null}

      {/* FIA Car Upgrades */}
      <Card
        className="race-weekend-card upgrade-summary-card"
        title={<div className="data-view-title"><span>{t('carUpgrades')}</span><small>{t('carUpgradesDescription')}</small></div>}
        loading={raceUpgradeLoading}
      >
        <div className="race-weekend-metric-grid upgrade-metric-grid">
          {raceUpgradeMetrics.map((item) => (
            <span key={item.label} className="race-weekend-metric">
              <small>{item.label}</small>
              <strong>{item.value}</strong>
              <em>{item.detail}</em>
            </span>
          ))}
        </div>
        {raceUpgradeSummary?.teams.length ? (
          <>
            <Table
              className="upgrade-summary-table"
              columns={raceUpgradeColumns}
              dataSource={raceUpgradeSummary.teams}
              rowKey={(record) => record.team}
              pagination={false}
              size="small"
              scroll={{ x: 'max-content' }}
            />
            {raceUpgradeSummary.sourceDocuments.length ? (
              <div className="upgrade-source-list">
                {raceUpgradeSummary.sourceDocuments.slice(0, 2).map((document) => document.url ? (
                  <a key={`${document.title}-${document.url}`} href={document.url} target="_blank" rel="noreferrer">
                    {document.title}
                  </a>
                ) : (
                  <span key={document.title}>{document.title}</span>
                ))}
              </div>
            ) : null}
          </>
        ) : raceUpgradeError ? (
          <div className="race-weekend-empty">{t('carUpgradesLoadFailed')}: {raceUpgradeError.message}</div>
        ) : (
          <div className="race-weekend-empty">{t('noCarUpgrades')}</div>
        )}
      </Card>
    </div>
  );
};

export default RacePreview;
