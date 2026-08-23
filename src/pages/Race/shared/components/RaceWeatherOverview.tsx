import { Button, Card, Descriptions } from 'antd';
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
    <section className="race-info-section" aria-labelledby="race-weather-heading">
      <div className="race-info-section-heading">
        <span id="race-weather-heading">{RACE_INFO_TEXT.weatherOverview}</span>
        <small>FastF1 session data</small>
      </div>
      {summary ? (
        <Card className="race-weekend-card race-info-weather-card">
          <Descriptions column={3} size="small" colon={false} bordered>
            <Descriptions.Item label={<span style={{ fontWeight: 600 }}>{RACE_INFO_TEXT.trackTempRange}</span>}>
              {formatTemperature(summary.trackTempC.min)}
              {' ~ '}
              {formatTemperature(summary.trackTempC.max)}
            </Descriptions.Item>
            <Descriptions.Item label={<span style={{ fontWeight: 600 }}>{RACE_INFO_TEXT.airTempRange}</span>}>
              {formatTemperature(summary.airTempC.min)}
              {' ~ '}
              {formatTemperature(summary.airTempC.max)}
            </Descriptions.Item>
            <Descriptions.Item label={<span style={{ fontWeight: 600 }}>{t('humidity')}</span>}>
              {formatPercent(summary.humidityPct.average)}
            </Descriptions.Item>
            <Descriptions.Item label={<span style={{ fontWeight: 600 }}>{RACE_INFO_TEXT.rainfall}</span>}>
              {summary.rainPointCount > 0 ? `有 (${summary.rainLapRanges.length} 段降雨区间)` : '无'}
            </Descriptions.Item>
            <Descriptions.Item label={<span style={{ fontWeight: 600 }}>{RACE_INFO_TEXT.windSpeed}</span>}>
              {formatWindSpeed(summary.maxWindSpeedMps)}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      ) : error ? (
        <Card className="race-weekend-card">
          <div className="race-weekend-empty" role="alert">
            <span>{error.message}</span>
            <Button onClick={onRetry}>重试天气数据</Button>
          </div>
        </Card>
      ) : !loading ? (
        <Card className="race-weekend-card">
          <div className="race-weekend-empty">{RACE_INFO_TEXT.noWeatherData}</div>
        </Card>
      ) : (
        <div className="race-info-inline-state" role="status">
          {t('loading')} {RACE_INFO_TEXT.weatherOverview}…
        </div>
      )}
    </section>
  );
}
