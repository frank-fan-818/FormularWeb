import axios from 'axios';
import { supabase } from '@/utils/supabase';
import type {
  ErgastResponse,
  Season,
  DriverStanding,
  ConstructorStanding,
  Race,
  Circuit,
  Driver,
  Constructor
} from '@/types';

const ergastApi = axios.create({
  baseURL: '/f1-api',
  timeout: 15000,
});

ergastApi.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    console.error('Jolpica API 请求失败:', error.message);
    // 返回空数据而不是模拟数据，确保用户知道出错了
    return Promise.reject(error);
  }
);

export const seasonApi = {
  getAllSeasons: async (limit = 100): Promise<Season[]> => {
    const response: ErgastResponse<never> = await ergastApi.get(`/seasons.json?limit=${limit}`);
    return response.MRData.SeasonTable?.Seasons || [];
  },

  // 获取单赛季所有冲刺赛结果
  getSeasonSprintResults: async (season: string): Promise<any[]> => {
    const response: ErgastResponse<never> = await ergastApi.get(`/${season}/sprint.json?limit=100`);
    return response.MRData.RaceTable?.Races || [];
  },

  getSeasonRaces: async (season: string): Promise<Race[]> => {
    const response: ErgastResponse<never> = await ergastApi.get(`/${season}.json`);
    return response.MRData.RaceTable?.Races || [];
  },

  getDriverStandings: async (season: string): Promise<DriverStanding[]> => {
    const response: ErgastResponse<never> = await ergastApi.get(`/${season}/driverStandings.json`);
    return response.MRData.StandingsTable?.StandingsLists[0]?.DriverStandings || [];
  },

  getConstructorStandings: async (season: string): Promise<ConstructorStanding[]> => {
    const response: ErgastResponse<never> = await ergastApi.get(`/${season}/constructorStandings.json`);
    return response.MRData.StandingsTable?.StandingsLists[0]?.ConstructorStandings || [];
  },

  getRaceResults: async (season: string, round: string): Promise<Race | null> => {
    const response: ErgastResponse<never> = await ergastApi.get(`/${season}/${round}/results.json`);
    return response.MRData.RaceTable?.Races[0] || null;
  },

  getQualifyingResults: async (season: string, round: string): Promise<Race | null> => {
    const response: ErgastResponse<never> = await ergastApi.get(`/${season}/${round}/qualifying.json`);
    return response.MRData.RaceTable?.Races[0] || null;
  },

  getSprintResults: async (season: string, round: string): Promise<Race | null> => {
    const response: ErgastResponse<never> = await ergastApi.get(`/${season}/${round}/sprint.json`);
    return response.MRData.RaceTable?.Races[0] || null;
  },

  getPracticeResults: async (season: string, round: string, practiceNumber: 1 | 2 | 3): Promise<Race | null> => {
    const response: ErgastResponse<never> = await ergastApi.get(`/${season}/${round}/practice/${practiceNumber}.json`);
    return response.MRData.RaceTable?.Races[0] || null;
  },

  getSprintQualifyingResults: async (season: string, round: string): Promise<Race | null> => {
    const response: ErgastResponse<never> = await ergastApi.get(`/${season}/${round}/sprintQualifying.json`);
    return response.MRData.RaceTable?.Races[0] || null;
  },
};

export const circuitApi = {
  getAllCircuits: async (limit = 100): Promise<Circuit[]> => {
    const { data } = await supabase
      .from('circuits')
      .select('*')
      .limit(limit);

    // 转换为原来的格式
    return (data || []).map(circuit => ({
      circuitId: circuit.circuit_id,
      url: '#',
      circuitName: circuit.name,
      Location: {
        lat: circuit.lat?.toString() || '0',
        long: circuit.long?.toString() || '0',
        locality: circuit.locality || '',
        country: circuit.country || ''
      }
    }));
  },
};

export const driverApi = {
  getAllDrivers: async (limit = 1000): Promise<Driver[]> => {
    const { data } = await supabase
      .from('drivers')
      .select('*')
      .limit(limit);

    // 转换为原来的格式
    return (data || []).map(driver => ({
      driverId: driver.driver_id,
      permanentNumber: driver.permanent_number || '',
      code: driver.code || '',
      url: '#',
      givenName: driver.first_name,
      familyName: driver.last_name,
      dateOfBirth: driver.date_of_birth || '',
      nationality: driver.nationality || ''
    }));
  },

  // 获取车手单赛季各分站积分
  getDriverSeasonRaceResults: async (driverId: string, season: string): Promise<any[]> => {
    const response: ErgastResponse<never> = await ergastApi.get(`/${season}/drivers/${driverId}/results.json?limit=100`);
    return response.MRData.RaceTable?.Races || [];
  },

  getDriverCareer: async (driverId: string): Promise<any> => {
    const response: ErgastResponse<never> = await ergastApi.get(`/drivers/${driverId}/driverStandings.json`);
    return response.MRData.StandingsTable?.StandingsLists || [];
  },

  // 获取车手总参赛场数
  getDriverRaceCount: async (driverId: string): Promise<number> => {
    const response: ErgastResponse<never> = await ergastApi.get(`/drivers/${driverId}/results.json?limit=1000`);
    return parseInt(response.MRData.total || '0', 10);
  },

  // 获取车手总杆位数
  getDriverPoleCount: async (driverId: string): Promise<number> => {
    const response: ErgastResponse<never> = await ergastApi.get(`/drivers/${driverId}/qualifying/1.json?limit=1000`);
    return parseInt(response.MRData.total || '0', 10);
  },

  // 获取车手总分冠数
  getDriverWinCount: async (driverId: string): Promise<number> => {
    const response: ErgastResponse<never> = await ergastApi.get(`/drivers/${driverId}/results/1.json?limit=1000`);
    return parseInt(response.MRData.total || '0', 10);
  },

  // 获取车手世界冠军数
  getDriverChampionshipCount: async (driverId: string): Promise<number> => {
    const response: ErgastResponse<never> = await ergastApi.get(`/drivers/${driverId}/driverStandings/1.json?limit=1000`);
    return parseInt(response.MRData.total || '0', 10);
  },

  // 获取车手生涯总积分
  getDriverTotalPoints: async (driverId: string): Promise<number> => {
    const standings = await driverApi.getDriverCareer(driverId);
    return standings.reduce((total: number, s: any) => total + parseFloat(s.points || 0), 0);
  },
};

export const constructorApi = {
  getAllConstructors: async (limit = 200): Promise<Constructor[]> => {
    const { data } = await supabase
      .from('constructors')
      .select('*')
      .limit(limit);

    // 转换为原来的格式
    return (data || []).map(constructor => ({
      constructorId: constructor.constructor_id,
      url: '#',
      name: constructor.name,
      nationality: constructor.nationality || ''
    }));
  },

  // 获取车队单赛季各分站积分
  getConstructorSeasonRaceResults: async (constructorId: string, season: string): Promise<any[]> => {
    const response: ErgastResponse<never> = await ergastApi.get(`/${season}/constructors/${constructorId}/results.json?limit=100`);
    return response.MRData.RaceTable?.Races || [];
  },

  // 获取车队总参赛场数
  getConstructorRaceCount: async (constructorId: string): Promise<number> => {
    const response: ErgastResponse<never> = await ergastApi.get(`/constructors/${constructorId}/results.json?limit=1000`);
    return parseInt(response.MRData.total || '0', 10);
  },

  // 获取车队总杆位数
  getConstructorPoleCount: async (constructorId: string): Promise<number> => {
    const response: ErgastResponse<never> = await ergastApi.get(`/constructors/${constructorId}/qualifying/1.json?limit=1000`);
    return parseInt(response.MRData.total || '0', 10);
  },

  // 获取车队总分冠数
  getConstructorWinCount: async (constructorId: string): Promise<number> => {
    const response: ErgastResponse<never> = await ergastApi.get(`/constructors/${constructorId}/results/1.json?limit=1000`);
    return parseInt(response.MRData.total || '0', 10);
  },

  // 获取车队世界冠军数
  getConstructorChampionshipCount: async (constructorId: string): Promise<number> => {
    const response: ErgastResponse<never> = await ergastApi.get(`/constructors/${constructorId}/constructorStandings/1.json?limit=1000`);
    return parseInt(response.MRData.total || '0', 10);
  },

  // 获取车队生涯总积分
  getConstructorTotalPoints: async (constructorId: string): Promise<number> => {
    const response: ErgastResponse<never> = await ergastApi.get(`/constructors/${constructorId}/constructorStandings.json?limit=1000`);
    const standings = response.MRData.StandingsTable?.StandingsLists || [];
    return standings.reduce((total: number, s: any) => total + parseFloat(s.points || 0), 0);
  },
};

export const historyApi = {
  getMostDriverChampionships: async (): Promise<any> => {
    const response: ErgastResponse<never> = await ergastApi.get('/driverStandings/1.json?limit=100');
    const standings = response.MRData.StandingsTable?.StandingsLists || [];
    const driverCounts: Record<string, { count: number; driver: any }> = {};

    standings.forEach((s: any) => {
      if (s.DriverStandings && s.DriverStandings[0]) {
        const driver = s.DriverStandings[0].Driver;
        const driverId = driver.driverId;
        if (!driverCounts[driverId]) {
          driverCounts[driverId] = { count: 0, driver };
        }
        driverCounts[driverId].count++;
      }
    });

    const sorted = Object.values(driverCounts).sort((a, b) => b.count - a.count);
    return sorted[0] || null;
  },

  getMostDriverWins: async (): Promise<any> => {
    const response: ErgastResponse<never> = await ergastApi.get('/results/1.json?limit=1');
    return response.MRData.RaceTable?.Races?.[0]?.Results?.[0]?.Driver || null;
  },

  getMostDriverPoles: async (): Promise<any> => {
    const response: ErgastResponse<never> = await ergastApi.get('/qualifying/1.json?limit=1');
    return response.MRData.RaceTable?.Races?.[0]?.QualifyingResults?.[0]?.Driver || null;
  },

  getMostConstructorChampionships: async (): Promise<any> => {
    const response: ErgastResponse<never> = await ergastApi.get('/constructorStandings/1.json?limit=100');
    const standings = response.MRData.StandingsTable?.StandingsLists || [];
    const constructorCounts: Record<string, { count: number; constructor: any }> = {};

    standings.forEach((s: any) => {
      if (s.ConstructorStandings && s.ConstructorStandings[0]) {
        const constructor = s.ConstructorStandings[0].Constructor;
        const constructorId = constructor.constructorId;
        if (!constructorCounts[constructorId]) {
          constructorCounts[constructorId] = { count: 0, constructor };
        }
        constructorCounts[constructorId].count++;
      }
    });

    const sorted = Object.values(constructorCounts).sort((a, b) => b.count - a.count);
    return sorted[0] || null;
  },

  getMostConstructorWins: async (): Promise<any> => {
    const response: ErgastResponse<never> = await ergastApi.get('/results/1.json?limit=1');
    return response.MRData.RaceTable?.Races?.[0]?.Results?.[0]?.Constructor || null;
  },
};

export default ergastApi;
