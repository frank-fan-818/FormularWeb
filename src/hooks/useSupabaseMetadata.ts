import { useCallback } from 'react';
import { useCachedData } from './useCachedData';

const SUPABASE_METADATA_CACHE_DURATION = 24 * 60 * 60 * 1000;

interface UseSupabaseMetadataReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  isOffline: boolean;
  refetch: () => void;
}

export function useSupabaseMetadata<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  enabled: boolean,
): UseSupabaseMetadataReturn<T> {
  const stableFetchFn = useCallback(fetchFn, [fetchFn]);

  return useCachedData(stableFetchFn, {
    cacheKey,
    cacheDuration: SUPABASE_METADATA_CACHE_DURATION,
    enabled,
    refreshOnMount: false,
  });
}
