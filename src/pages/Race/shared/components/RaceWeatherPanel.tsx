import { lazy, Suspense } from 'react';
import { Button, Card } from 'antd';
import { useTranslation } from '@/i18n';
import type { FastF1WeatherAnalysis } from '@/types';
import { formatWindSpeed } from '@/utils/raceDetailFormatters';
import {
  formatAnalysisLapRanges,
  formatAnalysisStatRange,
} from '@/utils/race/raceAnalysisViewModel';
import { AnalysisModuleState } from '@/pages/Race/shared/components/AnalysisModuleState';
import { ChartLoadingBeacon } from '@/components/loading/TimingBeacon';

const LazyEChartsPanel = lazy(() => import('@/components/charts/EChartsPanel'));

interface RaceWeatherPanelProps {
  enabled: boolean;
  collapsed: boolean;
  season: string;
  round: string;
  weather: FastF1WeatherAnalysis | null;
  option: unknown;
  isMobile: boolean;
  onToggleCollapsed: () => void;
}

export function RaceWeatherPanel({
  enabled,
  collapsed,
  season,
  round,
  weather,
  option,
  isMobile,
  onToggleCollapsed,
}: RaceWeatherPanelProps) {
  const { t } = useTranslation();
  if (!enabled) return null;
  if (!weather || !option) {
    return (
      <AnalysisModuleState
        id="analysis-weather"
        index="04"
        label="TRACK CONDITIONS"
        title={t('weatherTrend')}
        description="Weather samples are not available for this race session."
        state="empty"
      />
    );
  }

  return (
    <Card
      id="analysis-weather"
      data-module-index="04"
      className="fastf1-chart-card"
      title={(
        <div className="fastf1-chart-header">
          <div>
            <span className="analysis-module-kicker">04 / TRACK CONDITIONS</span>
            <h3 className="fastf1-chart-title">{t('weatherTrend')}</h3>
            <p>{t('weatherDescription')}</p>
          </div>
          <div className="weather-summary-pills" aria-label={t('weatherTrend')}>
            <span>{t('trackTemp')} {formatAnalysisStatRange(weather.summary.trackTempC)}</span>
            <span>{t('airTemp')} {formatAnalysisStatRange(weather.summary.airTempC)}</span>
            <span>{t('wind')} {formatWindSpeed(weather.summary.maxWindSpeedMps)}</span>
          </div>
        </div>
      )}
      extra={(
        <Button type="text" size="small" aria-expanded={!collapsed} aria-controls="analysis-weather-body" onClick={onToggleCollapsed}>
          {collapsed ? t('expand') : t('collapse')}
        </Button>
      )}
    >
      {collapsed ? <div id="analysis-weather-body" hidden /> : (
        <div id="analysis-weather-body">
          {weather.summary.rainLapRanges.length ? (
            <div className="weather-rain-legend" aria-label={t('rainfall')}>
              <span className="weather-rain-swatch" />
              <span>{t('rainfall')} {formatAnalysisLapRanges(weather.summary.rainLapRanges)}</span>
            </div>
          ) : null}
          <Suspense fallback={<ChartLoadingBeacon label="Rendering weather evolution" />}>
            <LazyEChartsPanel
              chartKey={`fastf1-weather-${season}-${round}`}
              height={isMobile ? 280 : 360}
              option={option}
              ariaLabel="赛道温度、气温与降雨随比赛圈数变化的趋势图。"
            />
          </Suspense>
        </div>
      )}
    </Card>
  );
}
