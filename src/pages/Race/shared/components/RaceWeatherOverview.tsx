import { Button } from 'antd';
import { useTranslation } from '@/i18n';
import type { FastF1WeatherSummary } from '@/types';
import {
  formatPercent,
  formatTemperature,
  formatWindSpeed,
} from '@/utils/raceDetailFormatters';
import { RACE_INFO_TEXT } from '@/pages/Race/shared/raceInfoConstants';

interface RaceWeatherOverviewProps {
  summary: FastF1WeatherSummary | null;
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
}

export function RaceWeatherOverview({ summary, loading, error, onRetry }: RaceWeatherOverviewProps) {
  const { t } = useTranslation();
  return (
    <section className="race-info-section weather-brief" aria-labelledby="race-weather-heading">
      <div className="race-info-section-heading">
        <span id="race-weather-heading">{RACE_INFO_TEXT.weatherOverview}</span>
        <small>FastF1 session data</small>
      </div>
      {summary ? (
        <dl className="weather-brief-metrics">
          <div className="weather-brief-temperature">
            <dt>{RACE_INFO_TEXT.trackTempRange}</dt>
            <dd>{formatTemperature(summary.trackTempC.min)}<span className="weather-range-separator">–</span>{formatTemperature(summary.trackTempC.max)}</dd>
          </div>
          <div className="weather-brief-temperature">
            <dt>{RACE_INFO_TEXT.airTempRange}</dt>
            <dd>{formatTemperature(summary.airTempC.min)}<span className="weather-range-separator">–</span>{formatTemperature(summary.airTempC.max)}</dd>
          </div>
          <div><dt>{t('humidity')}</dt><dd>{formatPercent(summary.humidityPct.average)}</dd></div>
          <div><dt>{RACE_INFO_TEXT.rainfall}</dt><dd>{summary.rainPointCount > 0 ? '有' : '无'}</dd>{summary.rainPointCount > 0 ? <span className="weather-brief-note">{summary.rainLapRanges.length} 段降雨区间</span> : null}</div>
          <div><dt>{RACE_INFO_TEXT.windSpeed}</dt><dd>{formatWindSpeed(summary.maxWindSpeedMps)}</dd></div>
        </dl>
      ) : error ? (
        <div className="weather-brief-state">
          <div className="race-weekend-empty" role="alert">
            <span>{error.message}</span>
            <Button onClick={onRetry}>重试天气数据</Button>
          </div>
        </div>
      ) : !loading ? (
        <div className="weather-brief-state">
          <div className="race-weekend-empty">{RACE_INFO_TEXT.noWeatherData}</div>
        </div>
      ) : (
        <div className="race-info-inline-state" role="status">
          {t('loading')} {RACE_INFO_TEXT.weatherOverview}…
        </div>
      )}
    </section>
  );
}
