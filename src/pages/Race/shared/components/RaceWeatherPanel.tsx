import { lazy, Suspense } from 'react';
import { Button, Card } from 'antd';
import { useTranslation } from 'react-i18next';
import type { FastF1WeatherAnalysis } from '@/types';
import { formatWindSpeed } from '@/utils/raceDetailFormatters';
import {
  formatAnalysisLapRanges,
  formatAnalysisStatRange,
} from '@/utils/race/raceAnalysisViewModel';

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
  if (!enabled || !weather || !option) return null;

  return (
    <Card
      id="analysis-weather"
      data-module-index="04"
      className="fastf1-chart-card"
      title={(
        <div className="fastf1-chart-header">
          <div>
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
          <Suspense fallback={<div className="race-weekend-empty">{t('loading')}</div>}>
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
