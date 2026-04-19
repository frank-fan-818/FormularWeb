import { useState } from 'react';
import { supabaseApi } from '@/api/supabase';
import type { SearchResultGroup } from '@/types';
import { buildSearchIndex, searchIndex } from '@/utils/search';

let cachedIndex: ReturnType<typeof buildSearchIndex> | null = null;
let loadingPromise: Promise<ReturnType<typeof buildSearchIndex>> | null = null;

async function loadSearchIndex() {
  if (cachedIndex) {
    return cachedIndex;
  }

  if (!loadingPromise) {
    loadingPromise = Promise.all([
      supabaseApi.drivers.getAll(),
      supabaseApi.constructors.getAll(),
      supabaseApi.circuits.getAll(),
    ])
      .then(([drivers, constructors, circuits]) => {
        cachedIndex = buildSearchIndex({ drivers, constructors, circuits });
        return cachedIndex;
      })
      .finally(() => {
        loadingPromise = null;
      });
  }

  return loadingPromise;
}

export function useGlobalSearch() {
  const [groups, setGroups] = useState<SearchResultGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ensureLoaded = async () => {
    if (cachedIndex) {
      return cachedIndex;
    }

    setLoading(true);
    setError(null);

    try {
      return await loadSearchIndex();
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Unable to load search data.');
      throw searchError;
    } finally {
      setLoading(false);
    }
  };

  const runSearch = async (query: string) => {
    if (!query.trim()) {
      setGroups([]);
      setError(null);
      return;
    }

    try {
      const index = cachedIndex || await ensureLoaded();
      setGroups(searchIndex(index, query));
    } catch {
      setGroups([]);
    }
  };

  const reset = () => {
    setGroups([]);
    setError(null);
  };

  return {
    groups,
    loading,
    error,
    ensureLoaded,
    runSearch,
    reset,
  };
}
