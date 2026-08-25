import { lazy, Suspense } from 'react';
import { Button, Card } from 'antd';
import { useTranslation } from '@/i18n';
import type { FastF1RaceAnalytics } from '@/types';
import { TRACK_STATUS_STYLES } from '@/pages/Race/shared/constants';
import { getCompoundColor } from '@/pages/Race/shared/charts/helpers';
import { formatCompoundWithCode } from '@/utils/tyreCompounds';
import { formatSeconds } from '@/utils/raceDetailFormatters';
import type { buildFastF1Summary } from '@/pages/Race/shared/sessionData';
import { AnalysisModuleState } from '@/pages/Race/shared/components/AnalysisModuleState';
import { ChartLoadingBeacon } from '@/components/loading/TimingBeacon';

const LazyEChartsPanel = lazy(() => import('@/components/charts/EChartsPanel'));

interface DriverLegendItem {
  driver: string;
  color: string;
}

interface RacePaceStrategyPanelsProps {
  analytics: FastF1RaceAnalytics;
  summary: ReturnType<typeof buildFastF1Summary>;
  season: string;
  round: string;
  lapPaceOption: unknown;
  tyreStrategyOption: unknown;
  driverLegendItems: DriverLegendItem[];
  selectedLapDrivers: string[];
  lapPaceCollapsed: boolean;
  tyreStrategyCollapsed: boolean;
  isMobile: boolean;
  onToggleLapDriver: (driver: string) => void;
  onToggleLapPace: () => void;
  onToggleTyreStrategy: () => void;
}

export function RacePaceStrategyPanels({
  analytics,
  summary,
  season,
  round,
  lapPaceOption,
  tyreStrategyOption,
  driverLegendItems,
  selectedLapDrivers,
  lapPaceCollapsed,
  tyreStrategyCollapsed,
  isMobile,
  onToggleLapDriver,
  onToggleLapPace,
  onToggleTyreStrategy,
}: RacePaceStrategyPanelsProps) {
  const { t } = useTranslation();
  const hasLapDriverFilter = selectedLapDrivers.length > 0;

  return (
    <>
      {lapPaceOption ? (
        <Card
          id="analysis-lap-pace"
          data-module-index="01"
          className="fastf1-chart-card"
          title={(
            <div className="fastf1-chart-header">
              <div>
                <span className="analysis-module-kicker">01 / RACE PACE</span>
                <h3 className="fastf1-chart-title">{t('lapPace')}</h3>
                <p>{t('lapPaceDescription')}</p>
              </div>
              {analytics.fastestLap ? (
                <div className="fastf1-chart-badges">
                  <span className="fastf1-fastest-lap-badge">
                    {t('fastestLap')} {analytics.fastestLap.driver} L{analytics.fastestLap.lapNumber}{' '}
                    {formatSeconds(analytics.fastestLap.lapTimeSeconds)}
                  </span>
                </div>
              ) : null}
            </div>
          )}
          extra={(
            <Button type="text" size="small" aria-expanded={!lapPaceCollapsed} aria-controls="analysis-lap-pace-body" onClick={onToggleLapPace}>
              {lapPaceCollapsed ? t('expand') : t('collapse')}
            </Button>
          )}
        >
          {lapPaceCollapsed ? <div id="analysis-lap-pace-body" hidden /> : (
            <div id="analysis-lap-pace-body">
              <div className="driver-legend" aria-label={t('driver')}>
                {driverLegendItems.map((item) => {
                  const isActive = !hasLapDriverFilter || selectedLapDrivers.includes(item.driver);
                  return (
                    <button
                      key={item.driver}
                      type="button"
                      className={`driver-legend-item${isActive ? ' is-active' : ' is-muted'}`}
                      aria-pressed={selectedLapDrivers.includes(item.driver)}
                      onClick={() => onToggleLapDriver(item.driver)}
                    >
                      <span className="driver-legend-line" style={{ backgroundColor: item.color }} />
                      {item.driver}
                    </button>
                  );
                })}
              </div>
              {analytics.trackStatusPeriods?.length ? (
                <div className="track-status-legend" aria-label={t('raceStatus')}>
                  {analytics.trackStatusPeriods.map((period, index) => (
                    <span key={`${period.type}-${period.startLap}-${index}`}>
                      <span
                        className="track-status-swatch"
                        style={{ backgroundColor: TRACK_STATUS_STYLES[period.type].color }}
                      />
                      {period.label} L{period.startLap}-L{period.endLap}
                    </span>
                  ))}
                </div>
              ) : null}
              <Suspense fallback={<ChartLoadingBeacon label="Rendering lap pace" />}>
                <LazyEChartsPanel
                  chartKey={`fastf1-laps-${season}-${round}`}
                  height={isMobile ? 320 : 430}
                  option={lapPaceOption}
                  ariaLabel="车手逐圈圈速趋势对比图，可使用上方车手图例筛选。"
                />
              </Suspense>
            </div>
          )}
        </Card>
      ) : (
        <AnalysisModuleState
          id="analysis-lap-pace"
          index="01"
          label="RACE PACE"
          title={t('lapPace')}
          description="Lap-by-lap pace traces are not available for this session."
          state="empty"
        />
      )}

      {analytics.tyreStrategies.length ? (
        <Card
          id="analysis-tyre"
          data-module-index="02"
          className="fastf1-chart-card"
          title={(
            <div className="fastf1-chart-header">
              <div>
                <span className="analysis-module-kicker">02 / STINT MODEL</span>
                <h3 className="fastf1-chart-title">{t('tyreStrategy')}</h3>
                <p>{t('tyreStrategyDescription')}</p>
              </div>
              {summary ? (
                <div className="compound-legend" aria-label={t('tyreStrategy')}>
                  {summary.compounds.map((compound) => (
                    <span key={compound} className="compound-legend-item">
                      <span className="compound-swatch" style={{ backgroundColor: getCompoundColor(compound) }} />
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
          )}
          extra={(
            <Button type="text" size="small" aria-expanded={!tyreStrategyCollapsed} aria-controls="analysis-tyre-body" onClick={onToggleTyreStrategy}>
              {tyreStrategyCollapsed ? t('expand') : t('collapse')}
            </Button>
          )}
        >
          {tyreStrategyCollapsed || !tyreStrategyOption ? <div id="analysis-tyre-body" hidden /> : (
            <div id="analysis-tyre-body">
              <Suspense fallback={<ChartLoadingBeacon label="Rendering tyre strategy" />}>
                <LazyEChartsPanel
                  chartKey={`fastf1-tyre-strategy-${season}-${round}`}
                  height={isMobile ? 300 : 400}
                  option={tyreStrategyOption}
                  ariaLabel="车手轮胎配方与使用圈数策略对比图。"
                />
              </Suspense>
            </div>
          )}
        </Card>
      ) : (
        <AnalysisModuleState
          id="analysis-tyre"
          index="02"
          label="STINT MODEL"
          title={t('tyreStrategy')}
          description="Tyre stints will appear after the FastF1 timing snapshot is complete."
          state="empty"
        />
      )}
    </>
  );
}
