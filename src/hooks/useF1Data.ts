import { useState, useEffect, useCallback } from 'react';
import { f1DataService } from '@/services';
import type { DriverStanding, ConstructorStanding, Race, Season } from '@/types';

interface UseSeasonDataReturn {
  driverStandings: DriverStanding[];
  constructorStandings: ConstructorStanding[];
  races: Race[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * 获取赛季数据 Hook
 * @param season - 赛季年份，如 "2025"
 */
export function useSeasonData(season: string): UseSeasonDataReturn {
  const [driverStandings, setDriverStandings] = useState<DriverStanding[]>([]);
  const [constructorStandings, setConstructorStandings] = useState<ConstructorStanding[]>([]);
  const [races, setRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await f1DataService.getSeasonData(season);
      setDriverStandings(data.driverStandings);
      setConstructorStandings(data.constructorStandings);
      setRaces(data.races);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch season data'));
    } finally {
      setLoading(false);
    }
  }, [season]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    driverStandings,
    constructorStandings,
    races,
    loading,
    error,
    refetch: fetchData,
  };
}

interface UseSeasonsReturn {
  seasons: Season[];
  loading: boolean;
  error: Error | null;
}

/**
 * 获取所有赛季列表
 */
export function useSeasons(limit = 100): UseSeasonsReturn {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const loadSeasons = async () => {
      setLoading(true);
      try {
        const data = await f1DataService.getSeasonData('2025');
        setSeasons(data.seasons.slice(0, limit));
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch seasons'));
      } finally {
        setLoading(false);
      }
    };
    loadSeasons();
  }, [limit]);

  return { seasons, loading, error };
}

interface UseDriverDetailsReturn {
  driver: any | null;
  loading: boolean;
  error: Error | null;
}

/**
 * 获取车手详细信息
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
    loadDriver();
  }, [driverId, season]);

  return { driver, loading, error };
}
