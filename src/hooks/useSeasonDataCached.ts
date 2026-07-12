import { useCallback } from 'react';
import { seasonApi } from '@/api/season';
import { getSeasonCacheDuration } from '@/utils/currentSeason';
import { useCachedData } from './useCachedData';
import type { ConstructorStanding, DriverStanding, Race, Season } from '@/types';

interface ResourceState {
  loading: boolean;
  error: Error | null;
  isOffline: boolean;
  isStale: boolean;
  updatedAt: number | null;
  refetch: () => void;
}

interface UseSeasonDataCachedReturn extends ResourceState {
  driverStandings: DriverStanding[];
  constructorStandings: ConstructorStanding[];
  races: Race[];
  resources: {
    drivers: ResourceState;
    constructors: ResourceState;
    races: ResourceState;
  };
}

interface DriverState extends ResourceState { driverStandings: DriverStanding[] }
interface ConstructorState extends ResourceState { constructorStandings: ConstructorStanding[] }
interface RaceState extends ResourceState { races: Race[] }
interface SeasonsState extends ResourceState { seasons: Season[] }

export function useDriverStandingsCached(season: string): DriverState {
  const fetchData = useCallback(() => seasonApi.getDriverStandings(season), [season]);
  const state = useCachedData(fetchData, {
    cacheKey: `driver-standings-${season}`,
    cacheDuration: getSeasonCacheDuration(season),
  });
  return { ...state, driverStandings: state.data ?? [] };
}

export function useConstructorStandingsCached(season: string): ConstructorState {
  const fetchData = useCallback(() => seasonApi.getConstructorStandings(season), [season]);
  const state = useCachedData(fetchData, {
    cacheKey: `constructor-standings-${season}`,
    cacheDuration: getSeasonCacheDuration(season),
  });
  return { ...state, constructorStandings: state.data ?? [] };
}

export function useSeasonRacesCached(season: string): RaceState {
  const fetchData = useCallback(() => seasonApi.getSeasonRaces(season), [season]);
  const state = useCachedData(fetchData, {
    cacheKey: `season-races-${season}`,
    cacheDuration: getSeasonCacheDuration(season),
  });
  return { ...state, races: state.data ?? [] };
}

export function useSeasonDataCached(season: string): UseSeasonDataCachedReturn {
  const drivers = useDriverStandingsCached(season);
  const constructors = useConstructorStandingsCached(season);
  const seasonRaces = useSeasonRacesCached(season);
  const hasData = drivers.driverStandings.length > 0
    || constructors.constructorStandings.length > 0
    || seasonRaces.races.length > 0;
  const timestamps = [drivers.updatedAt, constructors.updatedAt, seasonRaces.updatedAt]
    .filter((value): value is number => value !== null);

  return {
    driverStandings: drivers.driverStandings,
    constructorStandings: constructors.constructorStandings,
    races: seasonRaces.races,
    loading: !hasData && (drivers.loading || constructors.loading || seasonRaces.loading),
    error: drivers.error ?? constructors.error ?? seasonRaces.error,
    isOffline: drivers.isOffline || constructors.isOffline || seasonRaces.isOffline,
    isStale: drivers.isStale || constructors.isStale || seasonRaces.isStale,
    updatedAt: timestamps.length > 0 ? Math.min(...timestamps) : null,
    resources: {
      drivers,
      constructors,
      races: seasonRaces,
    },
    refetch: () => {
      drivers.refetch();
      constructors.refetch();
      seasonRaces.refetch();
    },
  };
}

export function useSeasonsCached(limit = 100): SeasonsState {
  const fetchData = useCallback(async () => {
    const seasons = await seasonApi.getAllSeasons(limit);
    return [...seasons].reverse();
  }, [limit]);
  const state = useCachedData(fetchData, {
    cacheKey: `season-list-${limit}`,
    cacheDuration: 60 * 60 * 1000,
  });
  return { ...state, seasons: state.data ?? [] };
}
