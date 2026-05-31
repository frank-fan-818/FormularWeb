import { lazy, Suspense, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useRaceData } from './RaceContext';
import { TEXT, TRACK_STATUS_STYLES, LIGHT_TAG_COLORS, DEFAULT_TAG_COLOR } from '@/pages/RaceDetail/constants';
import { isFeatureEnabled } from '@/utils/featureFlags';
import { buildLapPaceOption } from '@/pages/RaceDetail/charts/lapPace';
import { buildTyreStrategyOption } from '@/pages/RaceDetail/charts/tyreStrategy';
import { buildWeatherOption } from '@/pages/RaceDetail/charts/weather';
import {
  buildTelemetrySpeedOption,
  buildTelemetryControlOption,
  buildTelemetryHeatmapOption,
} from '@/pages/RaceDetail/charts/telemetry';
import { buildRankingBarOption, getTelemetrySummaryChartRows } from '@/pages/RaceDetail/charts/rankingBar';
import {
  getCompoundColor,
  formatSessionSeconds,
  getTelemetryDriverColor,
} from '@/pages/RaceDetail/charts/helpers';
import { DataViewPanel, type DataViewMode } from '@/pages/RaceDetail/components/DataViewPanels';
import { TyreStrategyTimeline } from '@/pages/RaceDetail/components/TyreStrategyTimeline';
import {
  buildFastF1Summary,
  getDriverLegendItems,
} from '@/pages/RaceDetail/sessionData';
import {
  getDuelDriverItems,
  getSelectedDuelDrivers,
  getDuelTyreSummaryItems,
  getDuelSectorGapItems,
  getDuelCornerRows,
  getActiveTelemetryDrivers,
} from '@/pages/RaceDetail/duelAnalysis';
import {
  formatNumber,
  formatPercent,
  formatSeconds,
  formatSignedNumber,
  formatSignedSeconds,
  formatSpeed,
  formatWindSpeed,
  getGapToneClassName,
} from '@/utils/raceDetailFormatters';
import { formatCompoundWithCode, getTyreAgeLabel } from '@/utils/tyreCompounds';
import { getTeamColor, normalizeConstructorId } from '@/utils/teamColors';
import type {
  FastF1CornerAnalysis,
  FastF1CornerDriverSpeed,
  FastF1TelemetryDriver,
  DriverPostRaceTelemetrySummary,
  FastF1WeatherLapRange,
} from '@/types';

const LazyEChartsPanel = lazy(() => import('@/components/charts/EChartsPanel'));

type TelemetryMetric = 'throttle' | 'brake' | 'gear' | 'rpm';

const TELEMETRY_METRICS: Array<{ key: TelemetryMetric; label: string }> = [
  { key: 'throttle', label: TEXT.throttle },
  { key: 'brake', label: TEXT.brake },
  { key: 'gear', label: TEXT.gear },
  { key: 'rpm', label: TEXT.rpm },
];

// ---- Local helpers (mirrored from RaceDetail.tsx) ----

function formatStatRange(summary?: { min: number | null; max: number | null }) {
  if (!summary || summary.min === null || summary.max === null) {
    return '-';
  }
  return `${formatNumber(summary.min, 1)}-${formatNumber(summary.max, 1)} C`;
}

function formatLapRange(range: FastF1WeatherLapRange) {
  return range.startLap === range.endLap
    ? `L${range.startLap}`
    : `L${range.startLap}-L${range.endLap}`;
}

function formatLapRanges(ranges: FastF1WeatherLapRange[] = []) {
  if (!ranges.length) {
    return '-';
  }
  return ranges.map(formatLapRange).join(', ');
}

interface CornerSpeedRow {
  key: string;
  corner: string;
  distanceM: number;
  drivers: FastF1CornerDriverSpeed[];
  minSpeedDelta: number | null;
}

function getCornerSpeedRows(
  cornerAnalysis: FastF1CornerAnalysis[],
  activeDrivers: FastF1TelemetryDriver[],
): CornerSpeedRow[] {
  if (!activeDrivers.length) {
    return [];
  }
  const activeDriverSet = new Set(activeDrivers.map((d) => d.driver));
  return cornerAnalysis.map((corner) => {
    const driverSpeeds = corner.drivers.filter((d) => activeDriverSet.has(d.driver));
    const minSpeedDelta = driverSpeeds.length === 2
      && driverSpeeds[0].minSpeedKph !== null
      && driverSpeeds[1].minSpeedKph !== null
      ? Number((driverSpeeds[0].minSpeedKph - driverSpeeds[1].minSpeedKph).toFixed(1))
      : null;
    return {
      key: `${corner.corner}-${corner.distanceM}`,
      corner: corner.corner,
      distanceM: corner.distanceM,
      drivers: driverSpeeds,
      minSpeedDelta,
    };
  });
}

function formatCornerSpeedSet(driverSpeed?: FastF1CornerDriverSpeed) {
  if (!driverSpeed) {
    return '-';
  }
  return [
    formatNumber(driverSpeed.entrySpeedKph, 0),
    formatNumber(driverSpeed.minSpeedKph, 0),
    formatNumber(driverSpeed.exitSpeedKph, 0),
  ].join(' / ');
}

// ---- Component ----

const RaceAnalysis = () => {
  const { t } = useTranslation();
  const {
    season,
    round,
    fastF1Analytics,
    fastF1QualifyingAnalytics,
    postRaceTelemetrySummary,
  } = useRaceData();

  // Local UI state — each sub-page manages its own selections so they are
  // isolated from the session-tab state in RaceContext.
  const [selectedLapDrivers, setSelectedLapDrivers] = useState<string[]>([]);
  const [selectedDuelDrivers, setSelectedDuelDrivers] = useState<string[]>([]);
  const [selectedTelemetryDrivers, setSelectedTelemetryDrivers] = useState<string[]>([]);
  const [selectedTelemetryMetrics, setSelectedTelemetryMetrics] = useState<TelemetryMetric[]>([
    'throttle',
    'brake',
    'gear',
    'rpm',
  ]);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [telemetrySummaryMode, setTelemetrySummaryMode] = useState<DataViewMode>('chart');

  // Feature flag checks
  const telemetryEnabled = isFeatureEnabled('fastf1-telemetry');
  const weatherEnabled = isFeatureEnabled('fastf1-weather');
  const duelEnabled = isFeatureEnabled('fastf1-duel');

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isCollapsed = (key: string) => !!collapsedSections[key];

  // ---- Lap driver handlers ----

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

  const handleDuelDriverToggle = (driver: string) => {
    setSelectedDuelDrivers((current) => {
      let next: string[];
      if (current.includes(driver)) {
        next = current.filter((d) => d !== driver);
      } else if (current.length < 2) {
        next = [...current, driver];
      } else {
        next = [current[1], driver];
      }
      // Sync lap pace highlight with duel selection
      setSelectedLapDrivers(next);
      return next;
    });
  };

  const handleTelemetryDriverToggle = (driver: string) => {
    setSelectedTelemetryDrivers((current) => {
      if (!current.length) {
        return [driver];
      }
      if (current.includes(driver)) {
        return current.filter((d) => d !== driver);
      }
      return [...current, driver];
    });
  };

  const handleTelemetryMetricToggle = (metric: TelemetryMetric) => {
    setSelectedTelemetryMetrics((current) => {
      if (current.includes(metric)) {
        return current.filter((m) => m !== metric);
      }
      return [...current, metric];
    });
  };

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

  const hasLapDriverFilter = selectedLapDrivers.length > 0;

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
    () => getDuelCornerRows(fastF1Analytics, selectedDuelDrivers),
    [fastF1Analytics, selectedDuelDrivers],
  );

  // ---- Telemetry ----

  const activeTelemetryDrivers = useMemo(
    () => getActiveTelemetryDrivers(fastF1Analytics, selectedTelemetryDrivers),
    [fastF1Analytics, selectedTelemetryDrivers],
  );

  const telemetrySpeedOption = useMemo(
    () => (fastF1Analytics
      ? buildTelemetrySpeedOption(fastF1Analytics, activeTelemetryDrivers)
      : null),
    [activeTelemetryDrivers, fastF1Analytics],
  );

  const telemetryControlOption = useMemo(
    () => (fastF1Analytics
      ? buildTelemetryControlOption(fastF1Analytics, activeTelemetryDrivers, selectedTelemetryMetrics)
      : null),
    [activeTelemetryDrivers, fastF1Analytics, selectedTelemetryMetrics],
  );

  const telemetryHeatmapOption = useMemo(
    () => (fastF1Analytics
      ? buildTelemetryHeatmapOption(fastF1Analytics, activeTelemetryDrivers)
      : null),
    [activeTelemetryDrivers, fastF1Analytics],
  );

  const telemetryDriverItems = useMemo(
    () => (fastF1Analytics?.telemetry?.drivers || []).map((driver) => ({
      driver: driver.driver,
      color: getTelemetryDriverColor(driver.driver, fastF1Analytics?.telemetry?.drivers || []),
      label: `${driver.driver} ${driver.lapTimeSeconds ? formatSeconds(driver.lapTimeSeconds) : ''}`.trim(),
    })),
    [fastF1Analytics],
  );

  const telemetryCornerRows = useMemo(
    () => getCornerSpeedRows(fastF1Analytics?.telemetry?.cornerAnalysis || [], activeTelemetryDrivers),
    [activeTelemetryDrivers, fastF1Analytics],
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

  const hasRaceAnalysisSection = Boolean(
    fastF1Analytics
    && (lapPaceOption || tyreStrategyOption || weatherOption || fastF1Analytics.telemetry),
  );

  // ---- Early return when no FastF1 data ----

  if (!fastF1Analytics) {
    return (
      <div className="fastf1-analytics-section">
        <div className="fastf1-analytics-heading">
          <div>
            <span className="fastf1-eyebrow">{t('fastF1Source')}</span>
            <h2>{t('raceAnalysisGroup')}</h2>
          </div>
        </div>
        <Card>
          <p>{t('noFastF1Analysis')}</p>
        </Card>
      </div>
    );
  }

  // ---- Render ----

  return (
    <div className="fastf1-analytics-section">
      {/* Heading + summary strip */}
      <div className="fastf1-analytics-heading">
        <div>
          <span className="fastf1-eyebrow">{t('fastF1Source')}</span>
          <h2>{t('raceAnalysisGroup')}</h2>
        </div>
        {fastF1Summary ? (
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
                  {formatStatRange(fastF1Summary.weatherSummary.trackTempC)}
                </span>
                <span>
                  {t('airTemp')}
                  {' '}
                  {formatStatRange(fastF1Summary.weatherSummary.airTempC)}
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
      </div>

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
                height={420}
                option={telemetrySummaryChartOption}
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
        {hasRaceAnalysisSection ? (
          <div className="fastf1-analysis-group fastf1-race-group">
            {/* ========== 1. Lap Pace ========== */}
            {fastF1Analytics && lapPaceOption ? (
              <Card
                className="fastf1-chart-card"
                title={
                  <div className="fastf1-chart-header">
                    <div>
                      <h3 className="fastf1-chart-title">{t('lapPace')}</h3>
                      <p>{t('lapPaceDescription')}</p>
                    </div>
                    <div className="fastf1-chart-badges">
                      {fastF1Analytics.fastestLap ? (
                        <span className="fastf1-fastest-lap-badge">
                          {t('fastestLap')}
                          {' '}
                          {fastF1Analytics.fastestLap.driver}
                          {' '}
                          L
                          {fastF1Analytics.fastestLap.lapNumber}
                          {' '}
                          {formatSeconds(fastF1Analytics.fastestLap.lapTimeSeconds)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                }
                extra={
                  <Button type="text" size="small" onClick={() => toggleSection('lapPace')}>
                    {isCollapsed('lapPace') ? t('expand') : t('collapse')}
                  </Button>
                }
              >
                {isCollapsed('lapPace') ? null : (
                  <>
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
                    {fastF1Analytics.trackStatusPeriods?.length ? (
                      <div className="track-status-legend" aria-label={t('raceStatus')}>
                        {fastF1Analytics.trackStatusPeriods.map((period, index) => (
                          <span key={`${period.type}-${period.startLap}-${index}`}>
                            <span
                              className="track-status-swatch"
                              style={{ backgroundColor: TRACK_STATUS_STYLES[period.type].color }}
                            />
                            {period.label}
                            {' '}
                            L
                            {period.startLap}
                            -
                            L
                            {period.endLap}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <Suspense fallback={<div className="race-weekend-empty">{t('loading')}</div>}>
                      <LazyEChartsPanel
                        chartKey={`fastf1-laps-${season}-${round}`}
                        height={430}
                        option={lapPaceOption}
                      />
                    </Suspense>
                  </>
                )}
              </Card>
            ) : null}

            {/* ========== 2. Tyre Strategy Chart ========== */}
            {fastF1Analytics.tyreStrategies.length ? (
              <Card
                className="fastf1-chart-card"
                title={
                  <div className="fastf1-chart-header">
                    <div>
                      <h3 className="fastf1-chart-title">{t('tyreStrategy')}</h3>
                      <p>{t('tyreStrategyDescription')}</p>
                    </div>
                    {fastF1Summary ? (
                      <div className="compound-legend" aria-label={t('tyreStrategy')}>
                        {fastF1Summary.compounds.map((compound) => (
                          <span key={compound} className="compound-legend-item">
                            <span
                              className="compound-swatch"
                              style={{ backgroundColor: getCompoundColor(compound) }}
                            />
                            {formatCompoundWithCode(season, round, compound)}
                          </span>
                        ))}
                        <span className="compound-legend-item tyre-age-legend-item">
                          <span className="tyre-age-line is-new" />
                          {'\u65b0\u80ce'}
                        </span>
                        <span className="compound-legend-item tyre-age-legend-item">
                          <span className="tyre-age-line is-used" />
                          {'\u65e7\u80ce'}
                        </span>
                      </div>
                    ) : null}
                  </div>
                }
                extra={
                  <Button type="text" size="small" onClick={() => toggleSection('tyreStrategy')}>
                    {isCollapsed('tyreStrategy') ? t('expand') : t('collapse')}
                  </Button>
                }
              >
                {isCollapsed('tyreStrategy') ? null : (
                  <>
                    {tyreStrategyOption ? (
                      <Suspense fallback={<div className="race-weekend-empty">{t('loading')}</div>}>
                        <LazyEChartsPanel
                          chartKey={`fastf1-tyre-strategy-${season}-${round}`}
                          height={400}
                          option={tyreStrategyOption}
                        />
                      </Suspense>
                    ) : null}
                    <TyreStrategyTimeline
                      analytics={fastF1Analytics}
                      highlightedDrivers={selectedDuelDrivers}
                      season={season}
                      round={round}
                    />
                  </>
                )}
              </Card>
            ) : null}

            {/* ========== 3. Driver Duel ========== */}
            {duelEnabled && fastF1Analytics ? (
              <Card
                className="fastf1-chart-card driver-duel-card"
                title={
                  <div className="fastf1-chart-header">
                    <div>
                      <h3 className="fastf1-chart-title">{t('driverDuel')}</h3>
                      <p>{t('driverDuelDescription')}</p>
                    </div>
                    {duelTyreSummaryItems.length ? (
                      <div className="duel-summary-pills" aria-label={t('driverDuel')}>
                        {duelTyreSummaryItems.map((item) => (
                          <span key={item.driver} className="duel-stint-pill">
                            <strong>{item.driver}</strong>
                            {item.stints.map((stint) => (
                              <span key={`${item.driver}-${stint.stint}`} className="duel-stint-token">
                                <span
                                  className="compound-swatch"
                                  style={{ backgroundColor: getCompoundColor(stint.compound) }}
                                />
                                <strong>{formatCompoundWithCode(season, round, stint.compound)}</strong>
                                <em>{getTyreAgeLabel(stint)}</em>
                                {formatSessionSeconds(stint.averagePaceSeconds)}
                                {stint.previousDeltaSeconds !== null ? (
                                  <em>{formatSignedSeconds(stint.previousDeltaSeconds)}</em>
                                ) : null}
                              </span>
                            ))}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                }
                extra={
                  <Button type="text" size="small" onClick={() => toggleSection('driverDuel')}>
                    {isCollapsed('driverDuel') ? t('expand') : t('collapse')}
                  </Button>
                }
              >
                {isCollapsed('driverDuel') ? null : (
                  <>
                    <div className="driver-legend" aria-label={t('driverDuel')}>
                      {duelDriverItems.map((item) => {
                        const isActive = selectedDuelDrivers.includes(item.driver);
                        const isMuted = selectedDuelDrivers.length === 2 && !isActive;
                        return (
                          <button
                            key={item.driver}
                            type="button"
                            className={`driver-legend-item${isActive ? ' is-active' : ''}${isMuted ? ' is-muted' : ''}`}
                            aria-pressed={isActive}
                            onClick={() => handleDuelDriverToggle(item.driver)}
                          >
                            <span
                              className="driver-legend-line"
                              style={{ backgroundColor: item.color }}
                            />
                            {item.driver}
                            {isActive ? (
                              <span className="duel-pick-badge">
                                {selectedDuelDrivers.indexOf(item.driver) + 1}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                    {activeDuelDrivers.length === 2 ? (
                      <div className="duel-grid">
                        {duelSectorGapItems.length ? (
                          <div className="duel-sector-panel">
                            <div className="telemetry-panel-title">
                              {t('qualifying')}
                              {' '}
                              Gap
                            </div>
                            <div className="duel-sector-gap-grid">
                              {duelSectorGapItems.map((item) => (
                                <div
                                  key={item.key}
                                  className={`duel-sector-gap-card ${getGapToneClassName(item.value)}`}
                                >
                                  <span>{item.label}</span>
                                  <strong>{formatSignedSeconds(item.value)}</strong>
                                  <em>
                                    {item.firstDriver}
                                    {' '}
                                    vs
                                    {' '}
                                    {item.secondDriver}
                                  </em>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {duelCornerRows.length ? (
                          <div className="duel-corner-panel">
                            <div className="telemetry-panel-title">{t('cornerSpeed')}</div>
                            <div className="duel-corner-grid">
                              {duelCornerRows.map((row) => (
                                <div key={row.key} className="duel-corner-card">
                                  <div className="duel-corner-head">
                                    <span>{row.corner}</span>
                                    <em>
                                      {formatNumber(row.distanceM, 0)}
                                      m
                                    </em>
                                  </div>
                                  <div className="duel-corner-row">
                                    <strong>{row.driverA}</strong>
                                    <span>{formatSpeed(row.firstMinSpeed)}</span>
                                  </div>
                                  <div className="duel-corner-row">
                                    <strong>{row.driverB}</strong>
                                    <span>{formatSpeed(row.secondMinSpeed)}</span>
                                  </div>
                                  <div className="duel-corner-row is-delta">
                                    <strong>{t('delta')}</strong>
                                    <span>{formatSignedNumber(row.delta, 1)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="duel-empty-state">
                        {t('driverDuel')}
                        :
                        {' '}
                        {t('driver')}
                        {' '}
                        2
                      </div>
                    )}
                  </>
                )}
              </Card>
            ) : null}

            {/* ========== 4. Strategy Timeline ========== */}
            {fastF1Analytics.tyreStrategies.length ? (
              <Card
                className="fastf1-chart-card"
                title={
                  <div className="fastf1-chart-header">
                    <div>
                      <h3 className="fastf1-chart-title">{t('strategyTimeline')}</h3>
                      <p>{t('strategyTimelineDescription')}</p>
                    </div>
                  </div>
                }
                extra={
                  <Button type="text" size="small" onClick={() => toggleSection('strategyTimeline')}>
                    {isCollapsed('strategyTimeline') ? t('expand') : t('collapse')}
                  </Button>
                }
              >
                {isCollapsed('strategyTimeline') ? null : (
                  <TyreStrategyTimeline
                    analytics={fastF1Analytics}
                    highlightedDrivers={selectedDuelDrivers}
                    season={season}
                    round={round}
                  />
                )}
              </Card>
            ) : null}

            {/* ========== 5. Weather Trend ========== */}
            {weatherEnabled && fastF1Analytics && weatherOption && fastF1Analytics.weather ? (
              <Card
                className="fastf1-chart-card"
                title={
                  <div className="fastf1-chart-header">
                    <div>
                      <h3 className="fastf1-chart-title">{t('weatherTrend')}</h3>
                      <p>{t('weatherDescription')}</p>
                    </div>
                    <div className="weather-summary-pills" aria-label={t('weatherTrend')}>
                      <span>
                        {t('trackTemp')}
                        {' '}
                        {formatStatRange(fastF1Analytics.weather.summary.trackTempC)}
                      </span>
                      <span>
                        {t('airTemp')}
                        {' '}
                        {formatStatRange(fastF1Analytics.weather.summary.airTempC)}
                      </span>
                      <span>
                        {t('wind')}
                        {' '}
                        {formatWindSpeed(fastF1Analytics.weather.summary.maxWindSpeedMps)}
                      </span>
                    </div>
                  </div>
                }
                extra={
                  <Button type="text" size="small" onClick={() => toggleSection('weather')}>
                    {isCollapsed('weather') ? t('expand') : t('collapse')}
                  </Button>
                }
              >
                {isCollapsed('weather') ? null : (
                  <>
                    {fastF1Analytics.weather.summary.rainLapRanges.length ? (
                      <div className="weather-rain-legend" aria-label={t('rainfall')}>
                        <span className="weather-rain-swatch" />
                        <span>
                          {t('rainfall')}
                          {' '}
                          {formatLapRanges(fastF1Analytics.weather.summary.rainLapRanges)}
                        </span>
                      </div>
                    ) : null}
                    <Suspense fallback={<div className="race-weekend-empty">{t('loading')}</div>}>
                      <LazyEChartsPanel
                        chartKey={`fastf1-weather-${season}-${round}`}
                        height={360}
                        option={weatherOption}
                      />
                    </Suspense>
                  </>
                )}
              </Card>
            ) : null}

            {/* ========== 6. Telemetry Comparison + Speed Heatmap ========== */}
            {telemetryEnabled && fastF1Analytics?.telemetry ? (
              <Card
                className="fastf1-chart-card telemetry-card"
                title={
                  <div className="fastf1-chart-header">
                    <div>
                      <h3 className="fastf1-chart-title">{t('telemetryComparison')}</h3>
                      <p>{t('telemetryDescription')}</p>
                    </div>
                  </div>
                }
                extra={
                  <Button type="text" size="small" onClick={() => toggleSection('telemetry')}>
                    {isCollapsed('telemetry') ? t('expand') : t('collapse')}
                  </Button>
                }
              >
                {isCollapsed('telemetry') ? null : (
                  <>
                    <div className="telemetry-driver-strip" aria-label={t('telemetryComparison')}>
                      {telemetryDriverItems.map((item) => {
                        const isActive = selectedTelemetryDrivers.includes(item.driver);
                        const isMuted = selectedTelemetryDrivers.length > 0 && !isActive;
                        return (
                          <button
                            key={item.driver}
                            type="button"
                            className={`driver-legend-item${isActive ? ' is-active' : ''}${isMuted ? ' is-muted' : ''}`}
                            aria-pressed={selectedTelemetryDrivers.includes(item.driver)}
                            onClick={() => handleTelemetryDriverToggle(item.driver)}
                          >
                            <span
                              className="driver-legend-line"
                              style={{ backgroundColor: item.color }}
                            />
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                    {telemetrySpeedOption ? (
                      <Suspense fallback={<div className="race-weekend-empty">{t('loading')}</div>}>
                        <LazyEChartsPanel
                          chartKey={`fastf1-telemetry-speed-${season}-${round}-${activeTelemetryDrivers.map((d) => d.driver).join('-')}`}
                          height={330}
                          option={telemetrySpeedOption}
                        />
                      </Suspense>
                    ) : null}

                    {/* Speed Heatmap */}
                    {telemetryHeatmapOption ? (
                      <div className="telemetry-heatmap-panel">
                        <div className="telemetry-panel-title">{t('speedHeatmap')}</div>
                        <Suspense fallback={<div className="race-weekend-empty">{t('loading')}</div>}>
                          <LazyEChartsPanel
                            chartKey={`fastf1-telemetry-heatmap-${season}-${round}-${activeTelemetryDrivers.map((d) => d.driver).join('-')}`}
                            height={360}
                            option={telemetryHeatmapOption}
                          />
                        </Suspense>
                        <div className="telemetry-heat-legend" aria-label={t('speedHeatmap')}>
                          <span className="telemetry-heat-low" />
                          {' '}
                          {t('minimum')}
                          <span className="telemetry-heat-high" />
                          {' '}
                          {t('speed')}
                        </div>
                      </div>
                    ) : null}

                    {telemetryControlOption ? (
                      <>
                        <div className="telemetry-chart-divider" />
                        <div className="telemetry-metric-strip" aria-label={t('telemetryComparison')}>
                          {TELEMETRY_METRICS.map((metric) => {
                            const isActive = selectedTelemetryMetrics.includes(metric.key);
                            return (
                              <button
                                key={metric.key}
                                type="button"
                                className={`telemetry-metric-button${isActive ? ' is-active' : ' is-muted'}`}
                                aria-pressed={isActive}
                                onClick={() => handleTelemetryMetricToggle(metric.key)}
                              >
                                {metric.label}
                              </button>
                            );
                          })}
                        </div>
                        <Suspense fallback={<div className="race-weekend-empty">{t('loading')}</div>}>
                          <LazyEChartsPanel
                            chartKey={`fastf1-telemetry-controls-${season}-${round}-${activeTelemetryDrivers.map((d) => d.driver).join('-')}-${selectedTelemetryMetrics.join('-')}`}
                            height={340}
                            option={telemetryControlOption}
                          />
                        </Suspense>
                      </>
                    ) : null}

                    {telemetryCornerRows.length ? (
                      <div className="telemetry-corner-table">
                        <div className="telemetry-panel-title">{t('cornerSpeed')}</div>
                        <Table
                          columns={telemetryCornerColumns}
                          dataSource={telemetryCornerRows}
                          pagination={false}
                          size="small"
                          scroll={{ x: 'max-content' }}
                        />
                      </div>
                    ) : null}
                  </>
                )}
              </Card>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default RaceAnalysis;
