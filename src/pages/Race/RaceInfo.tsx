import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Tag, Descriptions } from 'antd';
import {
  CalendarOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type {
  RecentGrandPrixResult,
  TrackInterruptionProbability,
  TrackInterruptionSample,
} from '@/types';
import type { FiaRaceUpgradeTeamSummary } from '@/api/fiaCarUpgrades';
import { getTeamColor } from '@/utils/teamColors';
import { isFeatureEnabled } from '@/utils/featureFlags';
import { getCircuitEnhancement, formatCircuitDirection } from '@/utils/circuitEnhancements';
import {
  getRaceWeekendSchedule,
  getRaceWeekendScheduleGroups,
} from '@/utils/raceSchedule';
import {
  formatProbability,
  formatShortDate,
  formatTemperature,
  formatPercent,
  formatWindSpeed,
} from '@/utils/raceDetailFormatters';
import {
  UPGRADE_REASON_LABELS,
  LIGHT_TAG_COLORS,
  DEFAULT_TAG_COLOR,
  TEXT,
} from '@/pages/Race/shared/constants';
import { useRaceData } from './RaceContext';
import ViewportTable from './shared/components/ViewportTable';
import '../RaceDetail.css';

// ---- Localised text for circuit info (not yet in i18n / TEXT constants) ----

const INFO_TEXT = {
  direction: '赛道方向',
  turns: '弯道数量',
  weatherOverview: '天气概况',
  trackTempRange: '赛道温度范围',
  airTempRange: '气温范围',
  rainfall: '降雨',
  windSpeed: '风速',
  noWeatherData: '暂无可用的天气数据',
};

// ---- Helpers ----

function driverIdToCode(driverId: string): string {
  const parts = driverId.split('_').filter(Boolean);
  const last = parts[parts.length - 1] || driverId;
  return last.slice(0, 3).toUpperCase();
}

// ---- Component ----

const RaceInfo = () => {
  const { t } = useTranslation();
  const {
    raceInfo,
    fastF1Analytics,
    racePreviewSummary,
    racePreviewLoading,
    raceUpgradeSummary,
    raceUpgradeLoading,
    raceUpgradeError,
    raceResults,
    qualifyingResults,
    sprintResults,
    availableDbSessions,
  } = useRaceData();

  // ---- Derived data ----

  const predictionsEnabled = isFeatureEnabled('race-predictions');

  // Driver code / constructor lookup from results and historical data
  const driverInfoByDriverId = useMemo(() => {
    const map = new Map<string, { code: string; constructorId: string; constructorName: string }>();
    [...raceResults, ...qualifyingResults, ...sprintResults].forEach((r) => {
      if (r.Driver?.driverId && r.Driver?.code) {
        map.set(r.Driver.driverId, {
          code: r.Driver.code,
          constructorId: r.Constructor?.constructorId || '',
          constructorName: r.Constructor?.name || '',
        });
      }
    });
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

  // Weekend schedule
  const weekendSchedule = getRaceWeekendSchedule(raceInfo, TEXT);
  const weekendScheduleGroups = getRaceWeekendScheduleGroups(weekendSchedule);

  // Circuit enhancement
  const circuitEnhancement = useMemo(
    () => (raceInfo ? getCircuitEnhancement(raceInfo.Circuit.circuitId) : {}),
    [raceInfo],
  );

  // Weather summary from FastF1 analytics
  const weatherSummary = fastF1Analytics?.weather?.summary ?? null;

  // Sprint weekend detection
  const hasSprintQualifying = Boolean(raceInfo?.SprintQualifying)
    || availableDbSessions.includes('SQ')
    || availableDbSessions.includes('SS');
  const hasSprint = (sprintResults && sprintResults.length > 0)
    || Boolean(raceInfo?.Sprint)
    || availableDbSessions.includes('S');
  const isSprintWeekend = hasSprint || hasSprintQualifying;

  // ---- Recent winners metrics ----

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
  }, [racePreviewSummary, t]);

  // ---- Upgrade metrics ----

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
  ], [raceUpgradeSummary, t]);

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
      render: (value: number, record: FiaRaceUpgradeTeamSummary) => (
        <span className={`upgrade-intensity-pill upgrade-intensity-${record.maxComponentImportance >= 4 ? 'high' : 'normal'}`}>
          {value}
        </span>
      ),
    },
    {
      title: t('upgradeIntent'),
      key: 'dominantReason',
      width: 120,
      render: (_: unknown, record: FiaRaceUpgradeTeamSummary) => (
        <Tag color={record.dominantReason === 'Performance' ? 'red' : 'blue'}>
          {UPGRADE_REASON_LABELS[record.dominantReason]}
        </Tag>
      ),
    },
    {
      title: t('upgradeComponents'),
      key: 'componentNames',
      render: (_: unknown, record: FiaRaceUpgradeTeamSummary) => (
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
      render: (_: unknown, record: FiaRaceUpgradeTeamSummary) => record.documentUrl ? (
        <a href={record.documentUrl} target="_blank" rel="noreferrer">
          FIA
        </a>
      ) : 'FIA',
    },
  ];

  // ---- Loading / empty state ----

  if (!raceInfo) {
    return (
      <div className="race-weekend-empty">{t('notFound')}</div>
    );
  }

  // ---- Render ----

  return (
    <div className="race-info-page">
      <div className="race-info-section-heading">
        <span>{t('weekendSchedule')}</span>
        <small>ROUND {raceInfo.round} · {raceInfo.season}</small>
      </div>
      {/* Row: Circuit Info + Weekend Schedule */}
      <div className="race-info-overview">
        {/* Circuit Info Card */}
        <Card
          className="race-weekend-card race-info-circuit-card"
          title={<div className="data-view-title"><span>赛道特性</span></div>}
        >
          <Descriptions column={1} size="small" colon={false}>
            <Descriptions.Item label={<span style={{ fontWeight: 600 }}>{INFO_TEXT.direction}</span>}>
              {circuitEnhancement.direction
                ? formatCircuitDirection(circuitEnhancement.direction)
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label={<span style={{ fontWeight: 600 }}>{INFO_TEXT.turns}</span>}>
              {circuitEnhancement.leftTurns !== undefined && circuitEnhancement.rightTurns !== undefined
                ? `${circuitEnhancement.leftTurns}L / ${circuitEnhancement.rightTurns}R`
                : '-'}
            </Descriptions.Item>
            {isSprintWeekend && (
              <Descriptions.Item label={<span style={{ fontWeight: 600 }}>{t('sprintWeekend')}</span>}>
                <Tag color="red" style={{ fontWeight: 700 }}>{t('sprintWeekend')}</Tag>
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>

        {/* Weekend Schedule Card */}
        <Card
          className="race-weekend-card race-info-schedule-card"
          title={<div className="data-view-title"><span>{t('weekendSchedule')}</span></div>}
        >
          {weekendScheduleGroups.length ? (
            <div className="weekend-schedule" aria-label={t('weekendSchedule')}>
              <div className="weekend-schedule-topbar">
                <div>
                  <span className="weekend-schedule-eyebrow">{t('weekendSchedule')}</span>
                  <span className="weekend-schedule-source">{t('scheduleSourceHint')}</span>
                </div>
                <span className="weekend-time-toggle" aria-label={`${t('scheduleTimezone')} ${t('scheduleTimezoneValue')}`}>
                  <ClockCircleOutlined />
                  <strong>{t('scheduleTimezone')}</strong>
                  {t('scheduleTimezoneValue')}
                </span>
              </div>
              <div className="weekend-schedule-days">
                {weekendScheduleGroups.map((group) => (
                  <section key={group.key} className="weekend-schedule-day">
                    <div className="weekend-day-header">
                      <span className="weekend-day-name">{group.dayLabel}</span>
                      <span className="weekend-day-date">
                        <CalendarOutlined />
                        {group.dateLabel}
                      </span>
                    </div>
                    <div className="weekend-session-list">
                      {group.sessions.map((item) => (
                        <div key={item.key} className={`weekend-session weekend-session-${item.tone}`}>
                          <span className="weekend-session-code">{item.code}</span>
                          <span className="weekend-session-main">
                            <strong>{item.label}</strong>
                            <span>{t('scheduleTimezoneValue')}</span>
                          </span>
                          <time className="weekend-session-time">{item.timeLabel}</time>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          ) : (
            <div className="race-weekend-empty">{t('noPreviewData')}</div>
          )}
        </Card>
      </div>

      {/* Weather Overview */}
      <section className="race-info-section" aria-labelledby="race-weather-heading">
        <div className="race-info-section-heading">
          <span>{INFO_TEXT.weatherOverview}</span>
          <small>FastF1 session data</small>
        </div>
      {weatherSummary ? (
        <Card
          className="race-weekend-card race-info-weather-card"
          id="race-weather-heading"
        >
          <Descriptions column={3} size="small" colon={false} bordered>
            <Descriptions.Item label={<span style={{ fontWeight: 600 }}>{INFO_TEXT.trackTempRange}</span>}>
              {formatTemperature(weatherSummary.trackTempC.min)}
              {' ~ '}
              {formatTemperature(weatherSummary.trackTempC.max)}
            </Descriptions.Item>
            <Descriptions.Item label={<span style={{ fontWeight: 600 }}>{INFO_TEXT.airTempRange}</span>}>
              {formatTemperature(weatherSummary.airTempC.min)}
              {' ~ '}
              {formatTemperature(weatherSummary.airTempC.max)}
            </Descriptions.Item>
            <Descriptions.Item label={<span style={{ fontWeight: 600 }}>{t('humidity')}</span>}>
              {formatPercent(weatherSummary.humidityPct.average)}
            </Descriptions.Item>
            <Descriptions.Item label={<span style={{ fontWeight: 600 }}>{INFO_TEXT.rainfall}</span>}>
              {weatherSummary.rainPointCount > 0
                ? `\u6709 (${weatherSummary.rainLapRanges.length} \u6bb5\u964d\u96e8\u533a\u95f4)`
                : '\u65e0'}
            </Descriptions.Item>
            <Descriptions.Item label={<span style={{ fontWeight: 600 }}>{INFO_TEXT.windSpeed}</span>}>
              {formatWindSpeed(weatherSummary.maxWindSpeedMps)}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      ) : fastF1Analytics && !weatherSummary ? (
        <Card className="race-weekend-card">
          <div className="race-weekend-empty">{INFO_TEXT.noWeatherData}</div>
        </Card>
      ) : (
        <div className="race-info-inline-state" role="status">{t('loading')} {INFO_TEXT.weatherOverview}…</div>
      )}
      </section>

      {/* Row: Recent Winners + Interruption Risk */}
      <section className="race-info-section" aria-labelledby="race-context-heading">
        <div className="race-info-section-heading">
          <span id="race-context-heading">{t('recentWinners')}</span>
          <small>{t('preRaceDescription')}</small>
        </div>
      <div className="race-weekend-grid race-info-secondary-grid">
        {/* Recent Winners */}
        <Card
          className="race-weekend-card"
          loading={racePreviewLoading}
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
              <ViewportTable
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
        </Card>

        {/* Interruption Risk (feature-flagged) */}
        {predictionsEnabled ? (
          <Card
            className="race-weekend-card"
            loading={racePreviewLoading}
            title={<div className="data-view-title"><span>{t('interruptionRisk')}</span></div>}
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
              <ViewportTable
                columns={interruptionColumns}
                dataSource={racePreviewSummary?.interruptionProbabilities || []}
                rowKey={(record) => record.type}
                pagination={false}
                size="small"
              />
              <div className="race-weekend-subtable" style={{ marginTop: 12 }}>
                <h4 style={{ marginBottom: 8 }}>{t('sampleYears')}</h4>
                <ViewportTable
                  columns={interruptionSampleColumns}
                  dataSource={racePreviewSummary?.interruptionSamples || []}
                  rowKey={(record) => `${record.season}-${record.round}`}
                  pagination={false}
                  size="small"
                  scroll={{ x: 'max-content' }}
                />
              </div>
            </>
          </Card>
        ) : null}
      </div>
      </section>

      {/* FIA Car Upgrades (full width) */}
      <section className="race-info-section" aria-labelledby="race-upgrades-heading">
        <div className="race-info-section-heading">
          <span id="race-upgrades-heading">{t('carUpgrades')}</span>
          <small>{t('carUpgradesDescription')}</small>
        </div>
      <Card
        className="race-weekend-card upgrade-summary-card"
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
            <ViewportTable
              className="upgrade-summary-table"
              columns={raceUpgradeColumns}
              dataSource={raceUpgradeSummary.teams}
              rowKey={(record) => record.team}
              pagination={false}
              size="small"
              scroll={{ x: 'max-content' }}
            />
            {raceUpgradeSummary.sourceDocuments.length ? (
              <div className="upgrade-source-list" style={{ marginTop: 12 }}>
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
          <div className="race-weekend-empty">
            {t('carUpgradesLoadFailed')}
            :
            {raceUpgradeError.message}
          </div>
        ) : (
          <div className="race-weekend-empty">{t('noCarUpgrades')}</div>
        )}
      </Card>
      </section>
    </div>
  );
};

export default RaceInfo;
