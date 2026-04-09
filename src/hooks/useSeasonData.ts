import { useState, useEffect, useCallback } from 'react';
import { seasonApi } from '@/api/ergast';
import type { DriverStanding, ConstructorStanding, Race, Season } from '@/types';

interface UseSeasonDataReturn {
  driverStandings: DriverStanding[];
  constructorStandings: ConstructorStanding[];
  races: Race[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

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
      const [drivers, constructors, seasonRaces] = await Promise.all([
        seasonApi.getDriverStandings(season),
        seasonApi.getConstructorStandings(season),
        seasonApi.getSeasonRaces(season),
      ]);
      setDriverStandings(drivers);
      setConstructorStandings(constructors);
      setRaces(seasonRaces);
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

export function useSeasons(limit = 100) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const loadSeasons = async () => {
      setLoading(true);
      try {
        const data = await seasonApi.getAllSeasons(limit);
        setSeasons(data.reverse());
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
