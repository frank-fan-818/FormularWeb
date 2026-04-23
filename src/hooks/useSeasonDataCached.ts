import { useCallback } from 'react';
import { seasonApi } from '@/api/season';
import { useCachedData } from './useCachedData';
import type { ConstructorStanding, DriverStanding, Race, Season } from '@/types';

interface SeasonData {
  driverStandings: DriverStanding[];
  constructorStandings: ConstructorStanding[];
  races: Race[];
}

interface UseSeasonDataCachedReturn {
  driverStandings: DriverStanding[];
  constructorStandings: ConstructorStanding[];
  races: Race[];
  loading: boolean;
  error: Error | null;
  isOffline: boolean;
  refetch: () => void;
}

interface UseSeasonsCachedReturn {
  seasons: Season[];
  loading: boolean;
  error: Error | null;
  isOffline: boolean;
  refetch: () => void;
}

export function useSeasonDataCached(season: string): UseSeasonDataCachedReturn {
  const fetchData = useCallback(async (): Promise<SeasonData> => {
    const [driverStandings, constructorStandings, races] = await Promise.all([
      seasonApi.getDriverStandings(season),
      seasonApi.getConstructorStandings(season),
      seasonApi.getSeasonRaces(season),
    ]);

    return {
      driverStandings,
      constructorStandings,
      races,
    };
  }, [season]);

  const { data, loading, error, isOffline, refetch } = useCachedData(fetchData, {
    cacheKey: `season-data-${season}`,
    cacheDuration: 60 * 60 * 1000,
  });

  return {
    driverStandings: data?.driverStandings ?? [],
    constructorStandings: data?.constructorStandings ?? [],
    races: data?.races ?? [],
    loading,
    error,
    isOffline,
    refetch,
  };
}

export function useSeasonsCached(limit = 100): UseSeasonsCachedReturn {
  const fetchData = useCallback(async (): Promise<Season[]> => {
    const seasons = await seasonApi.getAllSeasons(limit);
    return [...seasons].reverse();
  }, [limit]);

  const { data, loading, error, isOffline, refetch } = useCachedData(fetchData, {
    cacheKey: `season-list-${limit}`,
    cacheDuration: 60 * 60 * 1000,
  });

  return {
    seasons: data ?? [],
    loading,
    error,
    isOffline,
    refetch,
  };
}
