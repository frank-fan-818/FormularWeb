import { useEffect, useState } from 'react';
import { f1DataService } from '@/services';
import { useSeasonDataCached, useSeasonsCached } from './useSeasonDataCached';

/**
 * 赛季数据 Hook
 * @param season - 赛季年份，例如 "2025"
 */
export function useSeasonData(season: string) {
  return useSeasonDataCached(season);
}

/**
 * 赛季列表 Hook
 */
export function useSeasons(limit = 100) {
  return useSeasonsCached(limit);
}

interface UseDriverDetailsReturn {
  driver: any | null;
  loading: boolean;
  error: Error | null;
}

/**
 * 车手详情 Hook
 */
export function useDriverDetails(driverId: string, season: string): UseDriverDetailsReturn {
  const [driver, setDriver] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const loadDriver = async () => {
      if (!driverId) return;
      setLoading(true);
      try {
        const data = await f1DataService.getDriverDetails(driverId, season);
        setDriver(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch driver details'));
      } finally {
        setLoading(false);
      }
    };

    void loadDriver();
  }, [driverId, season]);

  return { driver, loading, error };
}
