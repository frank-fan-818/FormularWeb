import axios from 'axios';
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

seasonClient.interceptors.response.use(
  (response) => response.data,
  (error) => Promise.reject(error),
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
