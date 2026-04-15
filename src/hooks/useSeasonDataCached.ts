import { useCallback } from 'react';
import { seasonApi } from '@/api/ergast';
import { useCachedData } from './useCachedData';
import type { DriverStanding, ConstructorStanding, Race } from '@/types';

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
