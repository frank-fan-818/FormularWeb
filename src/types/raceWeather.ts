import type { FastF1WeatherSummary } from './index';

export interface RaceWeatherResponse {
  season: string;
  round: string;
  source: 'openf1';
  sessionKey: number | null;
  updatedAt: string;
  summary: FastF1WeatherSummary | null;
}
