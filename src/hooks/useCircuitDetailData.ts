import { useEffect, useMemo, useState } from 'react';
import { supabaseApi } from '@/api/supabase';
import { useSeasonRacesCached } from './useSeasonDataCached';
import type { Circuit, Race } from '@/types';
import { getCircuitDetails } from '@/utils/circuitData';
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

function deriveCircuitLength(details: Record<string, any>): string | undefined {
  if (details.length) {
    return String(details.length);
  }

  const totalDistanceText = String(details.total_distance || details.totalDistance || '');
  const totalDistance = Number(totalDistanceText.replace(/[^\d.]/g, ''));
  const raceLaps = Number(details.race_laps || details.raceLaps);

  if (!Number.isFinite(totalDistance) || !Number.isFinite(raceLaps) || raceLaps <= 0) {
    return undefined;
  }

  return (totalDistance / raceLaps).toFixed(3);
}

function normalizeLocalCircuitDetails(details: Record<string, any> | null): Record<string, any> | null {
  if (!details) {
    return null;
  }

  return {
    ...details,
    length: deriveCircuitLength(details),
    total_distance: details.total_distance || details.totalDistance,
    total_races: details.total_races || details.totalRaces,
    first_race: details.first_race || details.firstRace,
    lap_record: details.lap_record || details.lapRecord,
    lap_record_driver: details.lap_record_driver || details.lapRecordDriver,
    lap_record_year: details.lap_record_year || details.lapRecordYear,
    race_laps: details.race_laps || details.raceLaps,
  };
}

function mergeCircuitDetails(
  primary: Record<string, any> | null,
  fallback: Record<string, any> | null,
): Record<string, any> | null {
  if (!primary && !fallback) {
    return null;
  }

  if (!primary) {
    return fallback;
  }

  if (!fallback) {
    return primary;
  }

  return {
    ...fallback,
    ...primary,
    length: primary.length || fallback.length,
    total_distance: primary.total_distance || fallback.total_distance,
    total_races: primary.total_races || fallback.total_races,
    first_race: primary.first_race || fallback.first_race,
    lap_record: primary.lap_record || fallback.lap_record,
    lap_record_driver: primary.lap_record_driver || fallback.lap_record_driver,
    lap_record_year: primary.lap_record_year || fallback.lap_record_year,
    race_laps: primary.race_laps || fallback.race_laps,
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

  const request = Promise.all([
    supabaseApi.circuits.getById(supabaseId).catch(() => null),
    getCircuitDetails(supabaseId).then(normalizeLocalCircuitDetails).catch(() => null),
  ])
    .then(([databaseDetails, localDetails]) => {
      const result = mergeCircuitDetails(databaseDetails, localDetails);
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
