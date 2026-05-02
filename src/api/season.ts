import axios, { type InternalAxiosRequestConfig } from 'axios';
import type {
  ConstructorStanding,
  DriverStanding,
  ErgastResponse,
  Race,
  Season,
} from '@/types';

const baseURL = import.meta.env.DEV ? '/f1-api' : 'https://api.jolpi.ca/ergast/f1';

const seasonClient = axios.create({
  baseURL,
  timeout: 15000,
});

type TimedAxiosConfig = InternalAxiosRequestConfig & {
  requestStartedAt?: number;
};

function getNow() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function logJolpicaRequest(config: TimedAxiosConfig, status: 'success' | 'error') {
  if (!import.meta.env.DEV || typeof config.requestStartedAt !== 'number') {
    return;
  }

  console.debug('[perf]', {
    source: 'jolpica',
    name: config.url || 'unknown',
    status,
    durationMs: Math.round(getNow() - config.requestStartedAt),
  });
}

seasonClient.interceptors.request.use((config) => {
  (config as TimedAxiosConfig).requestStartedAt = getNow();
  return config;
});

seasonClient.interceptors.response.use(
  (response) => {
    logJolpicaRequest(response.config as TimedAxiosConfig, 'success');
    return response.data;
  },
  (error) => {
    if (error.config) {
      logJolpicaRequest(error.config as TimedAxiosConfig, 'error');
    }

    return Promise.reject(error);
  },
);

export const seasonApi = {
  async getAllSeasons(limit = 100): Promise<Season[]> {
    const response: ErgastResponse<never> = await seasonClient.get(`/seasons.json?limit=${limit}`);
    return response.MRData.SeasonTable?.Seasons || [];
  },

  async getSeasonRaces(season: string): Promise<Race[]> {
    const response: ErgastResponse<never> = await seasonClient.get(`/${season}.json`);
    return response.MRData.RaceTable?.Races || [];
  },

  async getDriverStandings(season: string): Promise<DriverStanding[]> {
    const response: ErgastResponse<never> = await seasonClient.get(`/${season}/driverStandings.json`);
    return response.MRData.StandingsTable?.StandingsLists[0]?.DriverStandings || [];
  },

  async getConstructorStandings(season: string): Promise<ConstructorStanding[]> {
    const response: ErgastResponse<never> = await seasonClient.get(`/${season}/constructorStandings.json`);
    return response.MRData.StandingsTable?.StandingsLists[0]?.ConstructorStandings || [];
  },
};
