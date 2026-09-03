import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '@/i18n';
import { Button, Card, Table, Tabs } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useRaceData } from './RaceContext';
import {
  LIGHT_TAG_COLORS,
} from '@/pages/Race/shared/constants';
import { buildLapPaceOption } from '@/pages/Race/shared/charts/lapPace';
import { buildTyreStrategyOption } from '@/pages/Race/shared/charts/tyreStrategy';
import { buildRankingBarOption } from '@/pages/Race/shared/charts/rankingBar';
import { getCompoundColor, formatSessionSeconds } from '@/pages/Race/shared/charts/helpers';
import {
  buildFastF1Summary,
  buildFastF1QualifyingRows,
  buildFastF1SprintRows,
  buildDriverLookup,
  buildConstructorLookup,
  getBestLapByDriver,
  getDriverLegendItems,
  buildPracticeRanking,
} from '@/pages/Race/shared/sessionData';
import type { PracticeRankingItem } from '@/pages/Race/shared/sessionData';
import { getTeamColor } from '@/utils/teamColors';
import { formatCompoundWithCode } from '@/utils/tyreCompounds';
import { formatSeconds } from '@/utils/raceDetailFormatters';
import type { QualifyingResult, Result } from '@/types';
import { RacePageIntro } from '@/pages/Race/shared/components/RacePageIntro';
import { ChartLoadingBeacon } from '@/components/loading/TimingBeacon';
import {
  getSessionDataPhase,
  getSessionUnavailableCopy,
} from '@/utils/race/sessionDataAvailability';

const LazyEChartsPanel = lazy(() => import('@/components/charts/EChartsPanel'));

const RaceSprint = () => {
  const { t } = useTranslation();
  const {
    season,
    round,
    sprintResults,
    sprintQualifyingResults,
    fastF1SprintAnalytics,
    fastF1SprintQualifyingAnalytics,
    fastF1SprintShootoutAnalytics,
    primaryLoading,
    isMobile,
    loadingSessionTabs,
    loadedSessionTabs,
    sessionLoadErrors,
    retrySession,
    raceInfo,
  } = useRaceData();

  // Local UI state for sprint-specific filtering
  const [selectedLapDrivers, setSelectedLapDrivers] = useState<string[]>([]);

  useEffect(() => {
    setSelectedLapDrivers([]);
  }, [round, season]);

  const handleLapDriverToggle = (driver: string) => {
    setSelectedLapDrivers((current) => {
      if (!current.length) {
        return [driver];
      }
      if (current.includes(driver)) {
        return current.filter((d) => d !== driver);
      }
      return [...current, driver];
    });
  };

  // ---- Determine which sprint qualifying analytics to use ----
  const activeSprintQualifyingAnalytics = season === '2023'
    ? fastF1SprintShootoutAnalytics || fastF1SprintQualifyingAnalytics
    : fastF1SprintQualifyingAnalytics || fastF1SprintShootoutAnalytics;

  // ---- Build driver / constructor lookups ----
  const participantRecords = useMemo(
    () => [...sprintQualifyingResults, ...sprintResults],
    [sprintQualifyingResults, sprintResults],
  );

  const driverByCode = useMemo(
    () => buildDriverLookup(participantRecords),
    [participantRecords],
  );

  const constructorByName = useMemo(
    () => buildConstructorLookup(participantRecords),
    [participantRecords],
  );

  // ---- Sprint qualifying rows ----
  const sprintQualifyingTableData = useMemo(() => {
    const fastF1Rows = buildFastF1QualifyingRows(
      activeSprintQualifyingAnalytics,
      driverByCode,
      constructorByName,
    );
    return fastF1Rows.length > 0 ? fastF1Rows : sprintQualifyingResults;
  }, [activeSprintQualifyingAnalytics, driverByCode, constructorByName, sprintQualifyingResults]);

  // ---- Sprint race rows ----
  const sprintRaceTableData = useMemo(() => {
    if (sprintResults.length > 0) {
      return sprintResults;
    }
    return buildFastF1SprintRows(fastF1SprintAnalytics, driverByCode, constructorByName);
  }, [sprintResults, fastF1SprintAnalytics, driverByCode, constructorByName]);

  // ---- Best laps ----
  const fastF1SprintQualifyingBestLapByDriver = useMemo(
    () => getBestLapByDriver(activeSprintQualifyingAnalytics),
    [activeSprintQualifyingAnalytics],
  );

  // ---- Sprint qualifying ranking bar (use buildPracticeRanking as sector time ranking) ----
  const sprintQualifyingRanking = useMemo(
    () => buildPracticeRanking(activeSprintQualifyingAnalytics),
    [activeSprintQualifyingAnalytics],
  );

  const sprintQualifyingRankingBarOption = useMemo(() => {
    if (!sprintQualifyingRanking.length) {
      return null;
    }
    return buildRankingBarOption(
      t('sprintQualifying'),
      t('lapTime'),
      sprintQualifyingRanking.map((item, _idx) => ({
        label: item.driver,
        value: item.bestTimeSeconds,
        displayValue: item.bestTime,
        color: getTeamColor(item.constructorId),
      })),
      (value: number) => formatSessionSeconds(value),
    );
  }, [sprintQualifyingRanking, t]);

  // ---- Sprint race charts ----
  const hasFastF1Sprint = Boolean(fastF1SprintAnalytics?.lapTimeSeries?.length);

  const fastF1SprintSummary = useMemo(
    () => (hasFastF1Sprint ? buildFastF1Summary(fastF1SprintAnalytics) : null),
    [fastF1SprintAnalytics, hasFastF1Sprint],
  );

  const lapPaceOption = useMemo(
    () => (hasFastF1Sprint
      ? buildLapPaceOption(fastF1SprintAnalytics!, selectedLapDrivers)
      : null),
    [fastF1SprintAnalytics, hasFastF1Sprint, selectedLapDrivers],
  );

  const tyreStrategyOption = useMemo(
    () => (hasFastF1Sprint && fastF1SprintAnalytics!.tyreStrategies.length > 0
      ? buildTyreStrategyOption(fastF1SprintAnalytics!, [], season, round)
      : null),
    [fastF1SprintAnalytics, hasFastF1Sprint, season, round],
  );

  const driverLegendItems = useMemo(
    () => getDriverLegendItems(fastF1SprintAnalytics?.lapTimeSeries || []),
    [fastF1SprintAnalytics],
  );

  const hasLapDriverFilter = selectedLapDrivers.length > 0;

  // ---- Qualifying table columns ----
  const qualifyingColumns: ColumnsType<QualifyingResult> = useMemo(() => {
    const phasePrefix = season === '2023' ? 'S' : 'SQ';

    // FastF1 best lap column (if data available)
    const fastF1Col = fastF1SprintQualifyingBestLapByDriver.size > 0
      ? [{
          title: t('fastestLap'),
          key: 'fastestLap',
          width: 90,
          render: (_: unknown, record: QualifyingResult) => {
            const lap = fastF1SprintQualifyingBestLapByDriver.get(record.Driver.code);
            if (!lap) {
              return '-';
            }
            return (
              <span className={lap.isDeleted ? 'fastf1-deleted-lap' : undefined}>
                {formatSessionSeconds(lap.lapTimeSeconds)}
                {lap.isDeleted ? ' *' : ''}
              </span>
            );
          },
        }]
      : [];

    return [
      { title: t('rank'), dataIndex: 'position', key: 'position', width: 60 },
      {
        title: t('driver'),
        key: 'driver',
        width: 160,
        render: (_: unknown, record: QualifyingResult) => {
          const color = getTeamColor(record.Constructor.constructorId);
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
                  minWidth: 36,
                  textAlign: 'center',
                }}
              >
                {record.Driver.code}
              </span>
              <span style={{ color: '#94a3b8', fontSize: 12 }}>{record.Constructor.name}</span>
            </div>
          );
        },
      },
      { title: `${phasePrefix}1`, dataIndex: 'Q1', key: 'Q1', width: 80 },
      { title: `${phasePrefix}2`, dataIndex: 'Q2', key: 'Q2', width: 80 },
      { title: `${phasePrefix}3`, dataIndex: 'Q3', key: 'Q3', width: 80 },
      ...fastF1Col,
    ];
  }, [t, season, fastF1SprintQualifyingBestLapByDriver]);

  // ---- Sprint race table columns ----
  const raceColumns: ColumnsType<Result> = useMemo(() => {
    let fastestLapTime = '';
    sprintRaceTableData.forEach((result) => {
      if (result.FastestLap?.Time?.time) {
        if (!fastestLapTime || result.FastestLap.Time.time < fastestLapTime) {
          fastestLapTime = result.FastestLap.Time.time;
        }
      }
    });

    return [
      { title: t('rank'), dataIndex: 'position', key: 'position', width: 60 },
      { title: t('grid'), dataIndex: 'grid', key: 'grid', width: 60 },
      {
        title: t('driver'),
        key: 'driver',
        width: 160,
        render: (_: unknown, record: Result) => {
          const color = getTeamColor(record.Constructor.constructorId);
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
                  minWidth: 36,
                  textAlign: 'center',
                }}
              >
                {record.Driver.code}
              </span>
              <span style={{ color: '#94a3b8', fontSize: 12 }}>{record.Constructor.name}</span>
            </div>
          );
        },
      },
      { title: t('laps'), dataIndex: 'laps', key: 'laps', width: 60 },
      {
        title: t('result'),
        key: 'time',
        render: (_: unknown, record: Result) => record.Time?.time || record.status,
      },
      {
        title: t('fastestLap'),
        key: 'fastestLap',
        render: (_: unknown, record: Result) => {
          const time = record.FastestLap?.Time?.time;
          if (!time) {
            return '-';
          }
          return time === fastestLapTime ? (
            <span className="fastest-lap">{time} *</span>
          ) : time;
        },
      },
      {
        title: t('points'),
        dataIndex: 'points',
        key: 'points',
        width: 60,
        render: (points: string) => <span className="points">{points}</span>,
      },
    ];
  }, [t, sprintRaceTableData]);

  // ---- No sprint data guard ----
  const hasSprintData = sprintQualifyingTableData.length > 0
    || sprintRaceTableData.length > 0
    || Boolean(activeSprintQualifyingAnalytics)
    || Boolean(fastF1SprintAnalytics);
  const isScheduledSprintWeekend = Boolean(
    raceInfo?.SprintQualifying || raceInfo?.Sprint || raceInfo?.isSprintWeekend,
  );
  const hasDeferredSprintError = Boolean(
    sessionLoadErrors.sprintQualifying || sessionLoadErrors.sprint,
  );

  if (!primaryLoading && !loadingSessionTabs.length && !hasDeferredSprintError && !hasSprintData && !isScheduledSprintWeekend) {
    return (
      <div className="fastf1-analytics-section">
        <RacePageIntro
          index="04"
          eyebrow="SPRINT WEEKEND / 冲刺周末"
          title="本场比赛没有冲刺赛"
        />
        <Card className="race-empty-command-card">
          <p>{'\u672C\u573A\u6BD4\u8D5B\u65E0\u51B2\u523A\u8D5B'}</p>
        </Card>
      </div>
    );
  }

  const renderDeferredSessionState = (
    sessionKey: 'sprintQualifying' | 'sprint',
    hasVisibleData: boolean,
  ) => {
    if (hasVisibleData) return null;
    const error = sessionLoadErrors[sessionKey];
    if (error) {
      return (
        <Card className="race-empty-command-card">
          <div className="race-weekend-empty" role="alert">
            <span>{error}</span>
            <Button onClick={() => retrySession(sessionKey)}>重试此场次</Button>
          </div>
        </Card>
      );
    }
    if (loadingSessionTabs.includes(sessionKey)) {
      return <Card loading className="race-empty-command-card" />;
    }
    if (loadedSessionTabs.includes(sessionKey)) {
      const isSprintQualifying = sessionKey === 'sprintQualifying';
      const copy = getSessionUnavailableCopy({
        label: isSprintQualifying ? '冲刺排位' : '冲刺赛',
        phase: getSessionDataPhase(isSprintQualifying ? raceInfo?.SprintQualifying : raceInfo?.Sprint),
      });
      return (
        <Card className="race-empty-command-card">
          <div className="race-weekend-empty">
            <strong>{copy.title}</strong>
            <span>{copy.description}</span>
            {copy.canRetry ? <Button onClick={() => retrySession(sessionKey)}>重试此场次</Button> : null}
          </div>
        </Card>
      );
    }
    return null;
  };

  // ---- Tab items ----
  const tabItems = [
    {
      key: 'sprintQualifying',
      label: t('sprintQualifying'),
      children: (
        <div className="fastf1-analysis-stack">
          {renderDeferredSessionState(
            'sprintQualifying',
            sprintQualifyingTableData.length > 0 || Boolean(sprintQualifyingRankingBarOption),
          )}
          {/* Qualifying results table */}
          {sprintQualifyingTableData.length > 0 && (
            <Card
              className="fastf1-chart-card"
              title={
                <div className="fastf1-chart-header">
                  <div>
                    <h3 className="fastf1-chart-title">{t('sprintQualifying')}</h3>
                  </div>
                </div>
              }
            >
              <Table
                columns={qualifyingColumns}
                dataSource={sprintQualifyingTableData}
                rowKey={(record) => `${record.Driver.code}-${record.position}`}
                pagination={false}
                size="small"
                scroll={{ x: 'max-content' }}
              />
            </Card>
          )}

          {/* Best sector times / ranking bar chart */}
          {sprintQualifyingRankingBarOption && (
            <Card
              className="fastf1-chart-card"
              title={
                <div className="fastf1-chart-header">
                  <div>
                    <h3 className="fastf1-chart-title">{t('lapPace')}</h3>
                    <p>{t('lapPaceDescription')}</p>
                  </div>
                </div>
              }
            >
              <Suspense fallback={<ChartLoadingBeacon label="Rendering sprint pace" />}>
                <LazyEChartsPanel
                  chartKey={`sprint-qualifying-ranking-${season}-${round}`}
                  height={isMobile ? 340 : 440}
                  option={sprintQualifyingRankingBarOption}
                  ariaLabel="车手冲刺排位最快圈成绩与差距排名图。"
                />
              </Suspense>
            </Card>
          )}

          {/* Sector best times table from FastF1 ranking */}
          {sprintQualifyingRanking.length > 0 && (
            <Card
              className="fastf1-chart-card"
              title={
                <div className="fastf1-chart-header">
                  <div>
                    <h3 className="fastf1-chart-title">{'\u6700\u4F73\u622A\u65AD\u65F6\u95F4'}</h3>
                  </div>
                </div>
              }
            >
              <Table
                columns={[
                  { title: t('rank'), key: 'rank', width: 50, render: (_: unknown, __: unknown, index: number) => index + 1 },
                  {
                    title: t('driver'),
                    key: 'driver',
                    render: (_: unknown, record: PracticeRankingItem) => {
                      const color = getTeamColor(record.constructorId);
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
                              minWidth: 36,
                              textAlign: 'center',
                            }}
                          >
                            {record.driver}
                          </span>
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>{record.team}</span>
                        </div>
                      );
                    },
                  },
                  {
                    title: t('result'),
                    key: 'bestTime',
                    width: 90,
                    render: (_: unknown, record: PracticeRankingItem) => (
                      <span style={{
                        fontWeight: record.bestTimeSeconds === sprintQualifyingRanking[0]?.bestTimeSeconds ? 700 : 400,
                        color: record.bestTimeSeconds === sprintQualifyingRanking[0]?.bestTimeSeconds ? '#a855f7' : undefined,
                      }}>
                        {record.bestTime}
                      </span>
                    ),
                  },
                  { title: 'Gap', key: 'gap', width: 80, dataIndex: 'gap' },
                  {
                    title: 'S1',
                    key: 'sector1',
                    width: 75,
                    render: (_: unknown, record: PracticeRankingItem) => (
                      <span style={{ color: '#f59e0b' }}>{record.sector1}</span>
                    ),
                  },
                  {
                    title: 'S2',
                    key: 'sector2',
                    width: 75,
                    render: (_: unknown, record: PracticeRankingItem) => (
                      <span style={{ color: '#3b82f6' }}>{record.sector2}</span>
                    ),
                  },
                  {
                    title: 'S3',
                    key: 'sector3',
                    width: 75,
                    render: (_: unknown, record: PracticeRankingItem) => (
                      <span style={{ color: '#10b981' }}>{record.sector3}</span>
                    ),
                  },
                ]}
                dataSource={sprintQualifyingRanking}
                rowKey={(record) => record.driver}
                pagination={false}
                size="small"
                scroll={{ x: 'max-content' }}
              />
            </Card>
          )}
        </div>
      ),
    },
    {
      key: 'sprintRace',
      label: t('sprint'),
      children: (
        <div className="fastf1-analysis-stack">
          {renderDeferredSessionState(
            'sprint',
            sprintRaceTableData.length > 0 || Boolean(lapPaceOption) || Boolean(tyreStrategyOption),
          )}
          {/* Sprint race results table */}
          {sprintRaceTableData.length > 0 && (
            <Card
              className="fastf1-chart-card"
              title={
                <div className="fastf1-chart-header">
                  <div>
                    <h3 className="fastf1-chart-title">{t('sprint')}</h3>
                  </div>
                </div>
              }
            >
              <Table
                columns={raceColumns}
                dataSource={sprintRaceTableData}
                rowKey={(record) => `${record.Driver.code}-${record.position}`}
                pagination={false}
                size="small"
                scroll={{ x: 'max-content' }}
              />
            </Card>
          )}

          {/* Sprint lap pace chart */}
          {lapPaceOption && hasFastF1Sprint && (
            <Card
              className="fastf1-chart-card"
              title={
                <div className="fastf1-chart-header">
                  <div>
                    <h3 className="fastf1-chart-title">{t('lapPace')}</h3>
                    <p>{t('lapPaceDescription')}</p>
                  </div>
                  {fastF1SprintAnalytics?.fastestLap ? (
                    <div className="fastf1-chart-badges">
                      <span className="fastf1-fastest-lap-badge">
                        {t('fastestLap')}
                        {' '}
                        {fastF1SprintAnalytics.fastestLap.driver}
                        {' '}
                        L{fastF1SprintAnalytics.fastestLap.lapNumber}
                        {' '}
                        {formatSeconds(fastF1SprintAnalytics.fastestLap.lapTimeSeconds)}
                      </span>
                    </div>
                  ) : null}
                </div>
              }
            >
              <div className="driver-legend" aria-label={t('driver')}>
                {driverLegendItems.map((item) => {
                  const isActive = !hasLapDriverFilter || selectedLapDrivers.includes(item.driver);
                  return (
                    <button
                      key={item.driver}
                      type="button"
                      className={`driver-legend-item${isActive ? ' is-active' : ' is-muted'}`}
                      aria-pressed={selectedLapDrivers.includes(item.driver)}
                      onClick={() => handleLapDriverToggle(item.driver)}
                    >
                      <span
                        className="driver-legend-line"
                        style={{ backgroundColor: item.color }}
                      />
                      {item.driver}
                    </button>
                  );
                })}
              </div>
              {fastF1SprintAnalytics?.trackStatusPeriods?.length ? (
                <div className="track-status-legend" aria-label={t('raceStatus')}>
                  {fastF1SprintAnalytics.trackStatusPeriods.map((period, index) => (
                    <span key={`${period.type}-${period.startLap}-${index}`}>
                      <span
                        className="track-status-swatch"
                        style={{ backgroundColor: period.type === 'YELLOW' ? 'rgba(245, 197, 66, 0.18)' : period.type === 'VSC' ? 'rgba(249, 115, 22, 0.16)' : period.type === 'SC' ? 'rgba(59, 130, 246, 0.14)' : 'rgba(239, 68, 68, 0.16)' }}
                      />
                      {period.label}
                      {' L'}
                      {period.startLap}
                      -
                      L
                      {period.endLap}
                    </span>
                  ))}
                </div>
              ) : null}
              <Suspense fallback={<ChartLoadingBeacon label="Rendering sprint strategy" />}>
                <LazyEChartsPanel
                  chartKey={`sprint-laps-${season}-${round}`}
                  height={isMobile ? 300 : 430}
                  option={lapPaceOption}
                  ariaLabel="冲刺赛车手逐圈圈速趋势对比图，可使用上方车手图例筛选。"
                />
              </Suspense>
            </Card>
          )}

          {/* Sprint tyre strategy */}
          {tyreStrategyOption && (
            <Card
              className="fastf1-chart-card"
              title={
                <div className="fastf1-chart-header">
                  <div>
                    <h3 className="fastf1-chart-title">{t('tyreStrategy')}</h3>
                    <p>{t('tyreStrategyDescription')}</p>
                  </div>
                  {fastF1SprintSummary ? (
                    <div className="compound-legend" aria-label={t('tyreStrategy')}>
                      {fastF1SprintSummary.compounds.map((compound) => (
                        <span key={compound} className="compound-legend-item">
                          <span
                            className="compound-swatch"
                            style={{ backgroundColor: getCompoundColor(compound) }}
                          />
                          {formatCompoundWithCode(season, round, compound)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              }
            >
              <Suspense fallback={<ChartLoadingBeacon label="Rendering sprint classification" />}>
                <LazyEChartsPanel
                  chartKey={`sprint-tyre-strategy-${season}-${round}`}
                  height={isMobile ? 320 : 400}
                  option={tyreStrategyOption}
                  ariaLabel="冲刺赛车手轮胎配方与使用圈数策略对比图。"
                />
              </Suspense>
            </Card>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="fastf1-analytics-section">
      <RacePageIntro
        index="04"
        eyebrow="SPRINT WEEKEND / 冲刺周末"
        title="冲刺赛分析"
        aside={fastF1SprintSummary ? (
          <div className="fastf1-summary-strip" aria-label={t('fastF1Analysis')}>
            <span>
              {fastF1SprintSummary.driverCount}
              {' '}
              {t('drivers')}
            </span>
            <span>
              {fastF1SprintSummary.maxLap}
              {' '}
              {t('summaryLaps')}
            </span>
            <span>
              {fastF1SprintSummary.stints}
              {' '}
              {t('stints')}
            </span>
          </div>
        ) : null}
      />

      <Tabs
        className="race-analysis-tabs race-sprint-tabs"
        defaultActiveKey="sprintQualifying"
        items={tabItems}
      />
    </div>
  );
};

export default RaceSprint;
