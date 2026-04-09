import { supabase } from '@/utils/supabase';

export const supabaseApi = {
  // 赛道相关
  circuits: {
    getAll: async () => {
      const { data, error } = await supabase
        .from('circuits')
        .select('*')
        .order('name');

      if (error) throw error;
      return data || [];
    },

    getById: async (circuitId: string) => {
      const { data, error } = await supabase
        .from('circuits')
        .select('*')
        .eq('circuit_id', circuitId);

      if (error) {
        console.warn('获取赛道详情失败:', error);
        return null;
      }
      return data && data.length > 0 ? data[0] : null;
    }
  },

  // 车手相关
  drivers: {
    getAll: async (limit = 1000) => {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .order('last_name')
        .limit(limit);

      if (error) throw error;
      return data || [];
    },

    getById: async (driverId: string) => {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('driver_id', driverId);

      if (error) {
        console.warn('获取车手详情失败:', error);
        return null;
      }
      return data && data.length > 0 ? data[0] : null;
    }
  },

  // 车队相关
  constructors: {
    getAll: async (limit = 200) => {
      const { data, error } = await supabase
        .from('constructors')
        .select('*')
        .order('name')
        .limit(limit);

      if (error) throw error;
      return data || [];
    },

    getById: async (constructorId: string) => {
      const { data, error } = await supabase
        .from('constructors')
        .select('*')
        .eq('constructor_id', constructorId);

      if (error) {
        console.warn('获取车队详情失败:', error);
        return null;
      }
      return data && data.length > 0 ? data[0] : null;
    }
  },

  // 赛季相关
  seasons: {
    getAll: async () => {
      const { data, error } = await supabase
        .from('seasons')
        .select('*')
        .order('year', { ascending: false });

      if (error) throw error;
      return data || [];
    }
  },

  // 比赛相关
  races: {
    getBySeason: async (season: number) => {
      const { data, error } = await supabase
        .from('races')
        .select('*')
        .eq('season', season)
        .order('round');

      if (error) throw error;
      return data || [];
    },

    getAll: async (limit = 100) => {
      const { data, error } = await supabase
        .from('races')
        .select('*')
        .order('season', { ascending: false })
        .order('round')
        .limit(limit);

      if (error) throw error;
      return data || [];
    }
  },

  // 比赛结果
  raceResults: {
    getByRace: async (raceId: number) => {
      const { data, error } = await supabase
        .from('race_results')
        .select('*')
        .eq('race_id', raceId)
        .order('position');

      if (error) throw error;
      return data || [];
    }
  },

  // 排位赛结果
  qualifyingResults: {
    getByRace: async (raceId: number) => {
      const { data, error } = await supabase
        .from('qualifying_results')
        .select('*')
        .eq('race_id', raceId)
        .order('position');

      if (error) throw error;
      return data || [];
    }
  }
};

export default supabaseApi;