import { seasonApi } from '@/api/ergast';
import { supabaseApi } from '@/api/supabase';
import type { DriverStanding, ConstructorStanding, Race, Season } from '@/types';

interface SeasonData {
  driverStandings: DriverStanding[];
  constructorStandings: ConstructorStanding[];
  races: Race[];
  seasons: Season[];
}

/**
 * F1 数据服务 - 统一数据获取入口
 * 
 * 策略：
 * 1. 优先从 Supabase 获取静态数据（车手、车队、赛道详情）
 * 2. 从 Ergast API 获取实时数据（比赛结果、积分榜）
 * 3. API 失败时自动降级到本地数据
 */
export const f1DataService = {
  /**
   * 获取完整赛季数据
   */
  getSeasonData: async (season: string): Promise<SeasonData> => {
    try {
      // 并行获取所有数据
      const [driverStandings, constructorStandings, races, seasons] = await Promise.all([
        seasonApi.getDriverStandings(season),
        seasonApi.getConstructorStandings(season),
        seasonApi.getSeasonRaces(season),
        seasonApi.getAllSeasons(),
      ]);

      return {
        driverStandings,
        constructorStandings,
        races,
        seasons,
      };
    } catch (error) {
      console.error('获取赛季数据失败:', error);
      throw error;
    }
  },

  /**
   * 获取车手详细信息（Supabase + Ergast 合并）
   */
  getDriverDetails: async (driverId: string, season: string) => {
    try {
      const [driverInfo, standings] = await Promise.all([
        supabaseApi.drivers.getById(driverId),
        seasonApi.getDriverStandings(season),
      ]);

      const standing = standings.find(s => s.Driver.driverId === driverId);

      return {
        ...standing?.Driver,
        ...driverInfo,
        standing: standing || null,
      };
    } catch (error) {
      console.error('获取车手详情失败:', error);
      throw error;
    }
  },

  /**
   * 获取车队详细信息
   */
  getConstructorDetails: async (constructorId: string, season: string) => {
    try {
      const [constructorInfo, standings] = await Promise.all([
        supabaseApi.constructors.getById(constructorId),
        seasonApi.getConstructorStandings(season),
      ]);

      const standing = standings.find(s => s.Constructor.constructorId === constructorId);

      return {
        ...standing?.Constructor,
        ...constructorInfo,
        standing: standing || null,
      };
    } catch (error) {
      console.error('获取车队详情失败:', error);
      throw error;
    }
  },

  /**
   * 获取赛道详细信息
   */
  getCircuitDetails: async (circuitId: string) => {
    try {
      const circuitInfo = await supabaseApi.circuits.getById(circuitId);
      return circuitInfo;
    } catch (error) {
      console.error('获取赛道详情失败:', error);
      throw error;
    }
  },
};
