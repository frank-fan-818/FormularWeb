import { lazy, Suspense, useMemo, useState } from 'react';
import { useTranslation } from '@/i18n';
import { Button, Card, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useRaceData } from './RaceContext';
import { LIGHT_TAG_COLORS, DEFAULT_TAG_COLOR } from '@/pages/Race/shared/constants';
import { isFeatureEnabled } from '@/utils/featureFlags';
import { buildLapPaceOption } from '@/pages/Race/shared/charts/lapPace';
import { buildTyreStrategyOption } from '@/pages/Race/shared/charts/tyreStrategy';
import { buildWeatherOption } from '@/pages/Race/shared/charts/weather';
import {
  buildTelemetrySpeedOption,
  buildTelemetryControlOption,
  buildTelemetryHeatmapOption,
} from '@/pages/Race/shared/charts/telemetry';
import { buildRankingBarOption, getTelemetrySummaryChartRows } from '@/pages/Race/shared/charts/rankingBar';
import { formatSessionSeconds, getTelemetryDriverColor } from '@/pages/Race/shared/charts/helpers';
import { DataViewPanel, type DataViewMode } from '@/pages/Race/shared/components/DataViewPanels';
import { RacePageIntro } from '@/pages/Race/shared/components/RacePageIntro';
import { RaceTelemetryPanel } from '@/pages/Race/shared/components/RaceTelemetryPanel';
import { RacePaceStrategyPanels } from '@/pages/Race/shared/components/RacePaceStrategyPanels';
import { RaceDriverDuelPanel } from '@/pages/Race/shared/components/RaceDriverDuelPanel';
import { RaceWeatherPanel } from '@/pages/Race/shared/components/RaceWeatherPanel';
import {
  buildFastF1Summary,
  getDriverLegendItems,
} from '@/pages/Race/shared/sessionData';
import {
  getDuelDriverItems,
  getSelectedDuelDrivers,
  getDuelTyreSummaryItems,
  getDuelSectorGapItems,
  getDuelCornerRows,
  getActiveTelemetryDrivers,
} from '@/pages/Race/shared/duelAnalysis';
import {
  formatNumber,
  formatPercent,
  formatSeconds,
  formatSpeed,
} from '@/utils/raceDetailFormatters';
import { getTeamColor, normalizeConstructorId } from '@/utils/teamColors';
import { useRaceAnalysisControls } from '@/hooks/race/useRaceAnalysisControls';
import { useViewportActivation } from '@/hooks/race/useViewportActivation';
import {
  formatAnalysisStatRange,
  formatCornerSpeedSet,
  getCornerSpeedRows,
  type CornerSpeedRow,
} from '@/utils/race/raceAnalysisViewModel';
import type {
  DriverPostRaceTelemetrySummary,
} from '@/types';

const LazyEChartsPanel = lazy(() => import('@/components/charts/EChartsPanel'));

// ---- Local helpers  ----


// ---- Component ----

const RaceAnalysis = () => {
  const { t } = useTranslation();
  const {
    season,
    round,
    fastF1Analytics,
    fastF1AnalyticsLoading,
    fastF1AnalyticsError,
    retryFastF1Analytics,
    fastF1QualifyingAnalytics,
    postRaceTelemetrySummary,
    fastF1Telemetry,
    fastF1TelemetryLoading,
    fastF1TelemetryError,
    loadFastF1Telemetry,
    isMobile,
  } = useRaceData();

  const telemetryEnabled = isFeatureEnabled('fastf1-telemetry');
  const weatherEnabled = isFeatureEnabled('fastf1-weather');
  const duelEnabled = isFeatureEnabled('fastf1-duel');
  const {
    selectedLapDrivers,
    selectedDuelDrivers,
    selectedTelemetryDrivers,
    selectedTelemetryMetrics,
    toggleSection,
    isCollapsed,
    handleLapDriverToggle,
    handleDuelDriverToggle,
    handleTelemetryDriverToggle,
    handleTelemetryMetricToggle,
  } = useRaceAnalysisControls(season, round);
  const [telemetrySummaryMode, setTelemetrySummaryMode] = useState<DataViewMode>('chart');
  const telemetrySectionRef = useViewportActivation({
    enabled: telemetryEnabled && Boolean(fastF1Analytics),
    onActivate: loadFastF1Telemetry,
  });

  // ---- Memoised derived data ----

  const fastF1Summary = useMemo(
    () => buildFastF1Summary(fastF1Analytics),
    [fastF1Analytics],
  );

  const lapPaceOption = useMemo(
    () => (fastF1Analytics ? buildLapPaceOption(fastF1Analytics, selectedLapDrivers) : null),
    [fastF1Analytics, selectedLapDrivers],
  );

  const tyreStrategyOption = useMemo(
    () => (fastF1Analytics
      ? buildTyreStrategyOption(fastF1Analytics, selectedDuelDrivers, season, round)
      : null),
    [fastF1Analytics, selectedDuelDrivers, season, round],
  );

  const weatherOption = useMemo(
    () => (fastF1Analytics ? buildWeatherOption(fastF1Analytics) : null),
    [fastF1Analytics],
  );

  const driverLegendItems = useMemo(
    () => getDriverLegendItems(fastF1Analytics?.lapTimeSeries || []),
    [fastF1Analytics],
  );

  // ---- Telemetry-aware analytics (merge lazy-loaded telemetry) ----

  const fastF1AnalyticsWithTelemetry = useMemo(() => {
    if (!fastF1Analytics) return null;
    if (!fastF1Telemetry) return fastF1Analytics;
    return { ...fastF1Analytics, telemetry: fastF1Telemetry };
  }, [fastF1Analytics, fastF1Telemetry]);

  // ---- Duel ----

  const duelDriverItems = useMemo(
    () => getDuelDriverItems(fastF1Analytics),
    [fastF1Analytics],
  );

  const activeDuelDrivers = useMemo(
    () => getSelectedDuelDrivers(fastF1Analytics, selectedDuelDrivers),
    [fastF1Analytics, selectedDuelDrivers],
  );

  const duelTyreSummaryItems = useMemo(
    () => getDuelTyreSummaryItems(fastF1Analytics, selectedDuelDrivers),
    [fastF1Analytics, selectedDuelDrivers],
  );

  const duelSectorGapItems = useMemo(
    () => getDuelSectorGapItems(fastF1QualifyingAnalytics, selectedDuelDrivers),
    [fastF1QualifyingAnalytics, selectedDuelDrivers],
  );

  const duelCornerRows = useMemo(
    () => getDuelCornerRows(fastF1AnalyticsWithTelemetry, selectedDuelDrivers),
    [fastF1AnalyticsWithTelemetry, selectedDuelDrivers],
  );

  // ---- Telemetry ----

  const activeTelemetryDrivers = useMemo(
    () => getActiveTelemetryDrivers(fastF1AnalyticsWithTelemetry, selectedTelemetryDrivers),
    [fastF1AnalyticsWithTelemetry, selectedTelemetryDrivers],
  );

  const telemetrySpeedOption = useMemo(
    () => (fastF1AnalyticsWithTelemetry
      ? buildTelemetrySpeedOption(fastF1AnalyticsWithTelemetry, activeTelemetryDrivers)
      : null),
    [activeTelemetryDrivers, fastF1AnalyticsWithTelemetry],
  );

  const telemetryControlOption = useMemo(
    () => (fastF1AnalyticsWithTelemetry
      ? buildTelemetryControlOption(fastF1AnalyticsWithTelemetry, activeTelemetryDrivers, selectedTelemetryMetrics)
      : null),
    [activeTelemetryDrivers, fastF1AnalyticsWithTelemetry, selectedTelemetryMetrics],
  );

  const telemetryHeatmapOption = useMemo(
    () => (fastF1AnalyticsWithTelemetry
      ? buildTelemetryHeatmapOption(fastF1AnalyticsWithTelemetry, activeTelemetryDrivers)
      : null),
    [activeTelemetryDrivers, fastF1AnalyticsWithTelemetry],
  );

  const telemetryDriverItems = useMemo(
    () => (fastF1Telemetry?.drivers || []).map((driver) => ({
      driver: driver.driver,
      color: getTelemetryDriverColor(driver.driver, fastF1Telemetry?.drivers || []),
      label: `${driver.driver} ${driver.lapTimeSeconds ? formatSeconds(driver.lapTimeSeconds) : ''}`.trim(),
    })),
    [fastF1Telemetry],
  );

  const telemetryCornerRows = useMemo(
    () => getCornerSpeedRows(fastF1Telemetry?.cornerAnalysis || [], activeTelemetryDrivers),
    [activeTelemetryDrivers, fastF1Telemetry],
  );

  const telemetryCornerColumns: ColumnsType<CornerSpeedRow> = [
    {
      title: t('corner'),
      key: 'corner',
      fixed: 'left' as const,
      width: 86,
      render: (_: unknown, record: CornerSpeedRow) => (
        <div>
          <div className="corner-label">{record.corner}</div>
          <div className="corner-distance">{formatNumber(record.distanceM, 0)} m</div>
        </div>
      ),
    },
    ...activeTelemetryDrivers.map((driver) => ({
      title: `${driver.driver} (${t('entry')}/${t('minimum')}/${t('exit')})`,
      key: `corner-${driver.driver}`,
      width: 150,
      render: (_: unknown, record: CornerSpeedRow) =>
        formatCornerSpeedSet(record.drivers.find((item) => item.driver === driver.driver)),
    })),
  ];

  if (activeTelemetryDrivers.length === 2) {
    telemetryCornerColumns.push({
      title: `${t('delta')} ${t('minimum')}`,
      key: 'minSpeedDelta',
      width: 92,
      render: (_: unknown, record: CornerSpeedRow) =>
        record.minSpeedDelta === null ? '-' : formatSpeed(record.minSpeedDelta),
    });
  }

  // ---- Telemetry summary ----

  const telemetrySummaryChartOption = useMemo(
    () => buildRankingBarOption(
      t('telemetrySummary'),
      'km/h',
      getTelemetrySummaryChartRows(postRaceTelemetrySummary),
      formatSpeed,
    ),
    [postRaceTelemetrySummary, t],
  );

  const telemetrySummaryColumns: ColumnsType<DriverPostRaceTelemetrySummary> = [
    {
      title: t('driver'),
      key: 'driver',
      fixed: 'left' as const,
      width: 120,
      render: (_: unknown, record: DriverPostRaceTelemetrySummary) => {
        const color = record.team
          ? getTeamColor(normalizeConstructorId(record.team))
          : DEFAULT_TAG_COLOR;
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
          </div>
        );
      },
    },
    {
      title: t('lap'),
      key: 'lapNumber',
      width: 82,
      render: (_: unknown, record: DriverPostRaceTelemetrySummary) =>
        record.lapNumber ? `L${record.lapNumber}` : '-',
    },
    {
      title: t('lapTime'),
      key: 'lapTimeSeconds',
      width: 110,
      render: (_: unknown, record: DriverPostRaceTelemetrySummary) =>
        formatSessionSeconds(record.lapTimeSeconds),
    },
    {
      title: t('maxSpeed'),
      dataIndex: 'maxSpeedKph',
      key: 'maxSpeedKph',
      width: 120,
      render: formatSpeed,
      sorter: (a: DriverPostRaceTelemetrySummary, b: DriverPostRaceTelemetrySummary) =>
        (a.maxSpeedKph || 0) - (b.maxSpeedKph || 0),
      defaultSortOrder: 'descend' as const,
    },
    {
      title: t('averageSpeed'),
      dataIndex: 'avgSpeedKph',
      key: 'avgSpeedKph',
      width: 120,
      render: formatSpeed,
    },
    {
      title: t('fullThrottle'),
      dataIndex: 'fullThrottlePct',
      key: 'fullThrottlePct',
      width: 110,
      render: formatPercent,
    },
    {
      title: t('averageThrottle'),
      dataIndex: 'avgThrottlePct',
      key: 'avgThrottlePct',
      width: 110,
      render: formatPercent,
    },
    {
      title: t('brake'),
      dataIndex: 'brakePct',
      key: 'brakePct',
      width: 90,
      render: formatPercent,
    },
    {
      title: t('drs'),
      dataIndex: 'drsPct',
      key: 'drsPct',
      width: 90,
      render: formatPercent,
    },
  ];

  // ---- Data existence checks ----

  // ---- Early return when no FastF1 data ----

  if (fastF1AnalyticsLoading) {
    return (
      <div className="fastf1-analytics-section">
        <RacePageIntro
          index="03"
          eyebrow="RACE DEBRIEF / 比赛解读"
          title="正在建立比赛证据链"
          description="正在读取比赛节奏、轮胎策略、天气和遥测摘要。"
        />
        <Card className="race-empty-command-card" loading>
          <p>{t('loading')}</p>
        </Card>
      </div>
    );
  }

  if (!fastF1Analytics) {
    return (
      <div className="fastf1-analytics-section">
        <RacePageIntro
          index="03"
          eyebrow="RACE DEBRIEF / 比赛解读"
          title="比赛证据链仍在生成"
          description="正赛数据可用后，这里会把比赛节奏、轮胎策略、车手攻防、天气和遥测串成完整的比赛故事。"
        />
        <Card className="race-empty-command-card">
          <p>{fastF1AnalyticsError?.message || t('noFastF1Analysis')}</p>
          {fastF1AnalyticsError ? <Button onClick={retryFastF1Analytics}>重试分析数据</Button> : null}
        </Card>
      </div>
    );
  }

  const strategySummary = fastF1Analytics.strategyAnalysis?.summary;
  const biggestStrategyGain = strategySummary?.biggestPositionGain;

  // ---- Render ----

  return (
    <div className="fastf1-analytics-section">
      <RacePageIntro
        index="03"
        eyebrow="RACE DEBRIEF / 比赛解读"
        title="从结果倒推，找到胜负真正发生的地方"
        description="沿着比赛节奏、轮胎、对决、天气与遥测逐层深入；每个模块都是同一场比赛的不同证据，而不是彼此孤立的图表。"
        aside={fastF1Summary ? (
          <div className="fastf1-summary-strip" aria-label={t('raceAnalysisGroup')}>
            <span>
              {fastF1Summary.driverCount}
              {' '}
              {t('drivers')}
            </span>
            <span>
              {fastF1Summary.maxLap}
              {' '}
              {t('summaryLaps')}
            </span>
            <span>
              {fastF1Summary.stints}
              {' '}
              {t('stints')}
            </span>
            <span>
              {fastF1Summary.statusCount}
              {' '}
              {t('raceStatus')}
            </span>
            {fastF1Summary.weatherSummary ? (
              <>
                <span>
                  {t('trackTemp')}
                  {' '}
                  {formatAnalysisStatRange(fastF1Summary.weatherSummary.trackTempC)}
                </span>
                <span>
                  {t('airTemp')}
                  {' '}
                  {formatAnalysisStatRange(fastF1Summary.weatherSummary.airTempC)}
                </span>
                <span>
                  {t('humidity')}
                  {' '}
                  {formatPercent(fastF1Summary.weatherSummary.humidityPct.average)}
                </span>
              </>
            ) : null}
          </div>
        ) : null}
      />

      <section className="race-analysis-brief" aria-label="比赛关键结论">
        <article>
          <span>PACE SIGNAL / 速度基准</span>
          <strong>{fastF1Analytics.fastestLap?.driver || '—'}</strong>
          <p>
            {fastF1Analytics.fastestLap
              ? `L${fastF1Analytics.fastestLap.lapNumber} · ${formatSeconds(fastF1Analytics.fastestLap.lapTimeSeconds)}`
              : '最快圈数据暂未生成'}
          </p>
        </article>
        <article>
          <span>STRATEGY SWING / 策略收益</span>
          <strong>{biggestStrategyGain?.driver || strategySummary?.pitStopCount || '—'}</strong>
          <p>
            {biggestStrategyGain
              ? `L${biggestStrategyGain.pitLap} 进站窗口 · +${biggestStrategyGain.value} 位置`
              : `${strategySummary?.pitStopCount || 0} 次进站记录`}
          </p>
        </article>
        <article>
          <span>RACE CONTROL / 比赛控制</span>
          <strong>{fastF1Analytics.trackStatusPeriods?.length || 0}</strong>
          <p>{fastF1Analytics.trackStatusPeriods?.length ? '段中断或管制阶段改变比赛节奏' : '未记录显著中断阶段'}</p>
        </article>
      </section>

      <nav className="analysis-section-nav" aria-label={t('raceAnalysisGroup')}>
        <span className="analysis-section-nav-label">ANALYSIS INDEX</span>
        {lapPaceOption ? <a href="#analysis-lap-pace"><b>01</b>{t('lapPace')}</a> : null}
        {fastF1Analytics.tyreStrategies.length ? <a href="#analysis-tyre"><b>02</b>{t('tyreStrategy')}</a> : null}
        {duelEnabled ? <a href="#analysis-duel"><b>03</b>{t('driverDuel')}</a> : null}
        {weatherEnabled && weatherOption ? <a href="#analysis-weather"><b>04</b>{t('weatherTrend')}</a> : null}
        {telemetryEnabled ? <a href="#analysis-telemetry"><b>05</b>{t('telemetryComparison')}</a> : null}
      </nav>

      {/* Telemetry Summary */}
      {telemetryEnabled && postRaceTelemetrySummary.length ? (
        <DataViewPanel
          title={t('telemetrySummary')}
          description={t('postRaceDescription')}
          className="race-weekend-post-card"
          mode={telemetrySummaryMode}
          collapsed={isCollapsed('telemetrySummary')}
          onModeChange={setTelemetrySummaryMode}
          onToggleCollapse={() => toggleSection('telemetrySummary')}
          chart={
            <Suspense fallback={<div className="race-weekend-empty">{t('loading')}</div>}>
              <LazyEChartsPanel
                chartKey={`post-race-telemetry-summary-${season}-${round}`}
                height={isMobile ? 300 : 420}
                option={telemetrySummaryChartOption}
                ariaLabel="车手赛后遥测综合评分排名图，可切换到同模块的数据表。"
              />
            </Suspense>
          }
          table={
            <Table
              columns={telemetrySummaryColumns}
              dataSource={postRaceTelemetrySummary}
              rowKey={(record) => record.driver}
              pagination={false}
              size="small"
              scroll={{ x: 'max-content' }}
            />
          }
        />
      ) : null}

      {/* FastF1 Analysis Cards */}
      <div className="fastf1-analysis-stack">
        <div className="fastf1-analysis-group fastf1-race-group">
            <RacePaceStrategyPanels
              analytics={fastF1Analytics}
              summary={fastF1Summary}
              season={season}
              round={round}
              lapPaceOption={lapPaceOption}
              tyreStrategyOption={tyreStrategyOption}
              driverLegendItems={driverLegendItems}
              selectedLapDrivers={selectedLapDrivers}
              lapPaceCollapsed={isCollapsed('lapPace')}
              tyreStrategyCollapsed={isCollapsed('tyreStrategy')}
              isMobile={isMobile}
              onToggleLapDriver={handleLapDriverToggle}
              onToggleLapPace={() => toggleSection('lapPace')}
              onToggleTyreStrategy={() => toggleSection('tyreStrategy')}
            />

            <RaceDriverDuelPanel
              enabled={duelEnabled}
              collapsed={isCollapsed('driverDuel')}
              season={season}
              round={round}
              selectedDrivers={selectedDuelDrivers}
              driverItems={duelDriverItems}
              tyreSummaryItems={duelTyreSummaryItems}
              sectorGapItems={duelSectorGapItems}
              cornerRows={duelCornerRows}
              duelReady={activeDuelDrivers.length === 2}
              onToggleCollapsed={() => toggleSection('driverDuel')}
              onToggleDriver={handleDuelDriverToggle}
            />

            <RaceWeatherPanel
              enabled={weatherEnabled}
              collapsed={isCollapsed('weather')}
              season={season}
              round={round}
              weather={fastF1Analytics.weather || null}
              option={weatherOption}
              isMobile={isMobile}
              onToggleCollapsed={() => toggleSection('weather')}
            />

            <div id="analysis-telemetry" ref={telemetrySectionRef} className="telemetry-section-anchor">
              <RaceTelemetryPanel
                enabled={telemetryEnabled}
                loading={fastF1TelemetryLoading}
                error={fastF1TelemetryError}
                telemetry={fastF1Telemetry}
                collapsed={isCollapsed('telemetry')}
                season={season}
                round={round}
                driverItems={telemetryDriverItems}
                selectedDrivers={selectedTelemetryDrivers}
                selectedMetrics={selectedTelemetryMetrics}
                activeDrivers={activeTelemetryDrivers}
                speedOption={telemetrySpeedOption}
                heatmapOption={telemetryHeatmapOption}
                controlOption={telemetryControlOption}
                cornerRows={telemetryCornerRows}
                cornerColumns={telemetryCornerColumns}
                isMobile={isMobile}
                onToggleCollapsed={() => toggleSection('telemetry')}
                onToggleDriver={handleTelemetryDriverToggle}
                onToggleMetric={handleTelemetryMetricToggle}
                onRetry={loadFastF1Telemetry}
              />
            </div>
          </div>
      </div>
    </div>
  );
};

export default RaceAnalysis;
