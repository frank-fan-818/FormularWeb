import { useEffect, useMemo, useState } from 'react';
import { supabaseApi } from '@/api/supabase';
import { useSeasonRacesCached } from './useSeasonDataCached';
import type { Circuit, Race } from '@/types';
import { areCircuitIdsEquivalent, getSupabaseCircuitId } from '@/utils/circuitIds';

interface CircuitRouteState {
  circuit?: Circuit & Record<string, unknown>;
}

interface UseCircuitDetailDataReturn {
  circuit: Circuit | null;
  circuitDetails: Record<string, any> | null;
  circuitRaces: Race[];
  seasonLoading: boolean;
  detailsLoading: boolean;
  loading: boolean;
}

const circuitDetailsCache = new Map<string, Record<string, any> | null>();
const circuitDetailsInFlight = new Map<string, Promise<Record<string, any> | null>>();

function mapSupabaseCircuitToCircuit(circuit: Record<string, any>, fallbackId: string): Circuit {
  return {
    circuitId: circuit.circuit_id || fallbackId,
    url: '#',
    circuitName: circuit.name,
    Location: {
      locality: circuit.locality || circuit.location || '',
      country: circuit.country || '',
      lat: String(circuit.lat || ''),
      long: String(circuit.long || circuit.lng || ''),
    },
  };
}

function getCircuitDetail(supabaseId: string): Promise<Record<string, any> | null> {
  if (circuitDetailsCache.has(supabaseId)) {
    return Promise.resolve(circuitDetailsCache.get(supabaseId) || null);
  }

  const inFlight = circuitDetailsInFlight.get(supabaseId);
  if (inFlight) {
    return inFlight;
  }

  const request = supabaseApi.circuits.getById(supabaseId)
    .then((result) => {
      circuitDetailsCache.set(supabaseId, result || null);
      return result || null;
    })
    .finally(() => {
      circuitDetailsInFlight.delete(supabaseId);
    });

  circuitDetailsInFlight.set(supabaseId, request);
  return request;
}

export function useCircuitDetailData(
  circuitId: string | undefined,
  season: string,
  routeState: CircuitRouteState | null,
): UseCircuitDetailDataReturn {
  const { races, loading: seasonLoading } = useSeasonRacesCached(season);
  const [circuitDetails, setCircuitDetails] = useState<Record<string, any> | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [fallbackCircuit, setFallbackCircuit] = useState<Circuit | null>(null);

  const routeCircuit = routeState?.circuit || null;
  const supabaseId = circuitId ? getSupabaseCircuitId(circuitId) : '';

  const circuitRaces = useMemo(
    () => circuitId ? races.filter((race) => areCircuitIdsEquivalent(race.Circuit.circuitId, circuitId)) : [],
    [circuitId, races],
  );
  const matchedRace = circuitRaces[0] || null;

  useEffect(() => {
    if (!supabaseId) {
      setCircuitDetails(null);
      setFallbackCircuit(null);
      setDetailsLoading(false);
      return;
    }

    let cancelled = false;
    const cachedDetails = circuitDetailsCache.get(supabaseId);

    if (cachedDetails !== undefined) {
      setCircuitDetails(cachedDetails);
      if (!matchedRace && cachedDetails) {
        setFallbackCircuit(mapSupabaseCircuitToCircuit(cachedDetails, supabaseId));
      }
      setDetailsLoading(false);
    } else {
      setCircuitDetails(null);
      setDetailsLoading(true);
    }

    void getCircuitDetail(supabaseId)
      .then((details) => {
        if (cancelled) {
          return;
        }

        setCircuitDetails(details);
        setFallbackCircuit(!matchedRace && details ? mapSupabaseCircuitToCircuit(details, supabaseId) : null);
      })
      .catch(() => {
        if (!cancelled) {
          setCircuitDetails(null);
          setFallbackCircuit(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDetailsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [matchedRace, supabaseId]);

  const circuit = matchedRace?.Circuit || routeCircuit || fallbackCircuit;

  return {
    circuit,
    circuitDetails,
    circuitRaces,
    seasonLoading,
    detailsLoading,
    loading: !circuit && (seasonLoading || detailsLoading),
  };
}
