import { lazy, Suspense } from 'react';
import { Button, Card, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from '@/i18n';
import { TEXT } from '@/pages/Race/shared/constants';
import type { TelemetryMetric } from '@/hooks/race/useRaceAnalysisControls';
import type { FastF1TelemetryAnalysis, FastF1TelemetryDriver } from '@/types';
import type { CornerSpeedRow } from '@/utils/race/raceAnalysisViewModel';

const LazyEChartsPanel = lazy(() => import('@/components/charts/EChartsPanel'));

const TELEMETRY_METRICS: Array<{ key: TelemetryMetric; label: string }> = [
  { key: 'throttle', label: TEXT.throttle },
  { key: 'brake', label: TEXT.brake },
  { key: 'gear', label: TEXT.gear },
  { key: 'rpm', label: TEXT.rpm },
];

interface TelemetryDriverItem {
  driver: string;
  color: string;
  label: string;
}

interface RaceTelemetryPanelProps {
  enabled: boolean;
  loading: boolean;
  error: Error | null;
  telemetry: FastF1TelemetryAnalysis | null;
  collapsed: boolean;
  season: string;
  round: string;
  driverItems: TelemetryDriverItem[];
  selectedDrivers: string[];
  selectedMetrics: TelemetryMetric[];
  activeDrivers: FastF1TelemetryDriver[];
  speedOption: unknown;
  heatmapOption: unknown;
  controlOption: unknown;
  cornerRows: CornerSpeedRow[];
  cornerColumns: ColumnsType<CornerSpeedRow>;
  isMobile: boolean;
  onToggleCollapsed: () => void;
  onToggleDriver: (driver: string) => void;
  onToggleMetric: (metric: TelemetryMetric) => void;
  onRetry: () => void;
}

export function RaceTelemetryPanel({
  enabled,
  loading,
  error,
  telemetry,
  collapsed,
  season,
  round,
  driverItems,
  selectedDrivers,
  selectedMetrics,
  activeDrivers,
  speedOption,
  heatmapOption,
  controlOption,
  cornerRows,
  cornerColumns,
  isMobile,
  onToggleCollapsed,
  onToggleDriver,
  onToggleMetric,
  onRetry,
}: RaceTelemetryPanelProps) {
  const { t } = useTranslation();
  const driverKey = activeDrivers.map((driver) => driver.driver).join('-');

  if (!enabled) return null;
  if (loading) return <Card className="fastf1-chart-card"><div className="race-weekend-empty">{t('loading')}</div></Card>;
  if (error) {
    return (
      <Card className="fastf1-chart-card">
        <div className="race-weekend-empty" role="alert">
          <span>{error.message}</span>
          <Button onClick={onRetry}>重试遥测数据</Button>
        </div>
      </Card>
    );
  }
  if (!telemetry) return <Card className="fastf1-chart-card"><div className="race-weekend-empty">{t('noPreviewData')}</div></Card>;

  return (
    <Card
      className="fastf1-chart-card telemetry-card"
      data-module-index="05"
      title={(
        <div className="fastf1-chart-header">
          <div>
            <h3 className="fastf1-chart-title">{t('telemetryComparison')}</h3>
            <p>{t('telemetryDescription')}</p>
          </div>
        </div>
      )}
      extra={(
        <Button type="text" size="small" aria-expanded={!collapsed} aria-controls="race-telemetry-body" onClick={onToggleCollapsed}>
          {collapsed ? t('expand') : t('collapse')}
        </Button>
      )}
    >
      {collapsed ? <div id="race-telemetry-body" hidden /> : (
        <div id="race-telemetry-body">
          <div className="telemetry-driver-strip" aria-label={t('telemetryComparison')}>
            {driverItems.map((item) => {
              const isActive = selectedDrivers.includes(item.driver);
              const isMuted = selectedDrivers.length > 0 && !isActive;
              return (
                <button
                  key={item.driver}
                  type="button"
                  className={`driver-legend-item${isActive ? ' is-active' : ''}${isMuted ? ' is-muted' : ''}`}
                  aria-pressed={isActive}
                  onClick={() => onToggleDriver(item.driver)}
                >
                  <span className="driver-legend-line" style={{ backgroundColor: item.color }} />
                  {item.label}
                </button>
              );
            })}
          </div>

          {speedOption ? (
            <Suspense fallback={<div className="race-weekend-empty">{t('loading')}</div>}>
              <LazyEChartsPanel
                chartKey={`fastf1-telemetry-speed-${season}-${round}-${driverKey}`}
                height={isMobile ? 280 : 330}
                option={speedOption}
                ariaLabel="所选车手沿赛道距离变化的速度曲线对比图。"
              />
            </Suspense>
          ) : null}

          {heatmapOption ? (
            <div className="telemetry-heatmap-panel">
              <div className="telemetry-panel-title">{t('speedHeatmap')}</div>
              <Suspense fallback={<div className="race-weekend-empty">{t('loading')}</div>}>
                <LazyEChartsPanel
                  chartKey={`fastf1-telemetry-heatmap-${season}-${round}-${driverKey}`}
                  height={isMobile ? 300 : 360}
                  option={heatmapOption}
                  ariaLabel="所选车手沿赛道各位置的速度热力对比图。"
                />
              </Suspense>
              <div className="telemetry-heat-legend" aria-label={t('speedHeatmap')}>
                <span className="telemetry-heat-low" /> {t('minimum')}
                <span className="telemetry-heat-high" /> {t('speed')}
              </div>
            </div>
          ) : null}

          {controlOption ? (
            <>
              <div className="telemetry-chart-divider" />
              <div className="telemetry-metric-strip" aria-label={t('telemetryComparison')}>
                {TELEMETRY_METRICS.map((metric) => {
                  const isActive = selectedMetrics.includes(metric.key);
                  return (
                    <button
                      key={metric.key}
                      type="button"
                      className={`telemetry-metric-button${isActive ? ' is-active' : ' is-muted'}`}
                      aria-pressed={isActive}
                      onClick={() => onToggleMetric(metric.key)}
                    >
                      {metric.label}
                    </button>
                  );
                })}
              </div>
              <Suspense fallback={<div className="race-weekend-empty">{t('loading')}</div>}>
                <LazyEChartsPanel
                  chartKey={`fastf1-telemetry-controls-${season}-${round}-${driverKey}-${selectedMetrics.join('-')}`}
                  height={isMobile ? 290 : 340}
                  option={controlOption}
                  ariaLabel="所选车手的油门、刹车、挡位与转速遥测对比图。"
                />
              </Suspense>
            </>
          ) : null}

          {cornerRows.length ? (
            <div className="telemetry-corner-table">
              <div className="telemetry-panel-title">{t('cornerSpeed')}</div>
              <Table
                columns={cornerColumns}
                dataSource={cornerRows}
                pagination={false}
                size="small"
                scroll={{ x: 'max-content' }}
              />
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}
