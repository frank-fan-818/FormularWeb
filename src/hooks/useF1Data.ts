import { useEffect, useState } from 'react';
import { f1DataService } from '@/services';
import type { DriverDetails } from '@/types';
import { useSeasonDataCached, useSeasonsCached } from './useSeasonDataCached';

export function useSeasonData(season: string) {
  return useSeasonDataCached(season);
}

export function useSeasons(limit = 100) {
  return useSeasonsCached(limit);
}

interface UseDriverDetailsReturn {
  driver: DriverDetails | null;
  loading: boolean;
  error: Error | null;
}

export function useDriverDetails(driverId: string, season: string): UseDriverDetailsReturn {
  const [driver, setDriver] = useState<DriverDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadDriver = async () => {
      if (!driverId) return;
      setLoading(true);
      setError(null);
      try {
        const data = await f1DataService.getDriverDetails(driverId, season);
        if (!cancelled) setDriver(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Failed to fetch driver details'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadDriver();
    return () => { cancelled = true; };
  }, [driverId, season]);

  return { driver, loading, error };
}
