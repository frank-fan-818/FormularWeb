import { useCallback } from 'react';
import { seasonApi } from '@/api/season';
import { getSeasonCacheDuration } from '@/utils/currentSeason';
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

interface UseDriverStandingsCachedReturn {
  driverStandings: DriverStanding[];
  loading: boolean;
  error: Error | null;
  isOffline: boolean;
  refetch: () => void;
}

interface UseConstructorStandingsCachedReturn {
  constructorStandings: ConstructorStanding[];
  loading: boolean;
  error: Error | null;
  isOffline: boolean;
  refetch: () => void;
}

interface UseSeasonRacesCachedReturn {
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
    cacheDuration: getSeasonCacheDuration(season),
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

export function useDriverStandingsCached(season: string): UseDriverStandingsCachedReturn {
  const fetchData = useCallback(() => seasonApi.getDriverStandings(season), [season]);

  const { data, loading, error, isOffline, refetch } = useCachedData(fetchData, {
    cacheKey: `driver-standings-${season}`,
    cacheDuration: getSeasonCacheDuration(season),
  });

  return {
    driverStandings: data ?? [],
    loading,
    error,
    isOffline,
    refetch,
  };
}

export function useConstructorStandingsCached(season: string): UseConstructorStandingsCachedReturn {
  const fetchData = useCallback(() => seasonApi.getConstructorStandings(season), [season]);

  const { data, loading, error, isOffline, refetch } = useCachedData(fetchData, {
    cacheKey: `constructor-standings-${season}`,
    cacheDuration: getSeasonCacheDuration(season),
  });

  return {
    constructorStandings: data ?? [],
    loading,
    error,
    isOffline,
    refetch,
  };
}

export function useSeasonRacesCached(season: string): UseSeasonRacesCachedReturn {
  const fetchData = useCallback(() => seasonApi.getSeasonRaces(season), [season]);

  const { data, loading, error, isOffline, refetch } = useCachedData(fetchData, {
    cacheKey: `season-races-${season}`,
    cacheDuration: getSeasonCacheDuration(season),
  });

  return {
    races: data ?? [],
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
