import type {
  DriverPostRaceTelemetrySummary,
  FastF1RaceAnalytics,
  FastF1TelemetryDriver,
  RacePreviewSummary,
  RecentGrandPrixResult,
  TrackInterruptionProbability,
} from '@/types';
import { supabase } from '@/utils/supabase';
import { measureRequest } from '@/utils/performance';
import { getCircuitIdCandidates, getSupabaseCircuitId } from '@/utils/circuitIds';
import { fastF1AnalyticsApi } from './fastf1Analytics';

type RaceSummaryRow = {
  id: number;
  season: number;
  round: number;
  race_name: string | null;
  circuit_id: string | null;
  date: string | null;
};

type RaceResultSummaryRow = {
  race_id: number;
  driver_id: string | null;
  constructor_id: string | null;
  position: number | string | null;
};

type QualifyingResultSummaryRow = {
  race_id: number;
  driver_id: string | null;
  constructor_id: string | null;
  position: number | string | null;
};

type DriverNameRow = {
  driver_id: string;
  first_name?: string | null;
  last_name?: string | null;
  code?: string | null;
};

type ConstructorNameRow = {
  constructor_id: string;
  name: string | null;
};

type FastF1SessionAnalyticsRow = {
  season: number;
  round: number;
  payload: FastF1RaceAnalytics;
};

const INTERRUPTION_LABELS: Record<TrackInterruptionProbability['type'], string> = {
  SC: 'Safety Car',
  VSC: 'Virtual Safety Car',
  RED: 'Red Flag',
  YELLOW: 'Yellow Flag',
};
const RECENT_RESULTS_HISTORY_LIMIT = 5;
const INTERRUPTION_HISTORY_LIMIT = 12;
const INTERRUPTION_LOOKBACK_SEASONS = 10;

function toPositionNumber(value: number | string | null | undefined) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function formatDriverName(row: DriverNameRow | undefined | null, fallback: string | null) {
  if (!row) {
    return fallback;
  }

  const firstName = row.first_name || '';
  const lastName = row.last_name || '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  return fullName || row.code || fallback;
}

function percentage(count: number, total: number) {
  if (total <= 0) {
    return null;
  }

  return Math.round((count / total) * 100);
}

async function getStaticFastF1Row(
  season: number,
  round: number,
): Promise<FastF1SessionAnalyticsRow | null> {
  const payload = await fastF1AnalyticsApi
    .getRaceAnalytics(String(season), String(round), 'R')
    .catch(() => null);

  if (!payload) {
    return null;
  }

  return {
    season,
    round,
    payload,
  };
}

function average(values: number[]) {
  if (!values.length) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number | null, decimals = 1) {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function buildRecentGrandPrixResults(
  races: RaceSummaryRow[],
  raceResults: RaceResultSummaryRow[],
  qualifyingResults: QualifyingResultSummaryRow[],
  drivers: DriverNameRow[] = [],
  constructors: ConstructorNameRow[] = [],
): RecentGrandPrixResult[] {
  const driverById = new Map(drivers.map((driver) => [driver.driver_id, driver]));
  const constructorById = new Map(constructors.map((constructor) => [constructor.constructor_id, constructor]));
  const raceResultsByRaceId = new Map<number, RaceResultSummaryRow[]>();
  const qualifyingResultsByRaceId = new Map<number, QualifyingResultSummaryRow[]>();

  raceResults.forEach((result) => {
    const items = raceResultsByRaceId.get(result.race_id) || [];
    items.push(result);
    raceResultsByRaceId.set(result.race_id, items);
  });

  qualifyingResults.forEach((result) => {
    const items = qualifyingResultsByRaceId.get(result.race_id) || [];
    items.push(result);
    qualifyingResultsByRaceId.set(result.race_id, items);
  });

  return [...races]
    .sort((a, b) => b.season - a.season || b.round - a.round)
    .map((race) => {
      const orderedRaceResults = [...(raceResultsByRaceId.get(race.id) || [])]
        .sort((a, b) => (toPositionNumber(a.position) ?? 999) - (toPositionNumber(b.position) ?? 999));
      const orderedQualifyingResults = [...(qualifyingResultsByRaceId.get(race.id) || [])]
        .sort((a, b) => (toPositionNumber(a.position) ?? 999) - (toPositionNumber(b.position) ?? 999));
      const winner = orderedRaceResults.find((result) => toPositionNumber(result.position) === 1) || null;
      const pole = orderedQualifyingResults.find((result) => toPositionNumber(result.position) === 1) || null;

      return {
        raceId: race.id,
        season: race.season,
        round: race.round,
        raceName: race.race_name || `${race.season} Round ${race.round}`,
        circuitId: race.circuit_id || '',
        date: race.date,
        winnerDriverId: winner?.driver_id || null,
        winnerName: formatDriverName(winner?.driver_id ? driverById.get(winner.driver_id) : null, winner?.driver_id || null),
        winnerConstructorId: winner?.constructor_id || null,
        winnerConstructorName: winner?.constructor_id
          ? constructorById.get(winner.constructor_id)?.name || winner.constructor_id
          : null,
        poleDriverId: pole?.driver_id || null,
        poleName: formatDriverName(pole?.driver_id ? driverById.get(pole.driver_id) : null, pole?.driver_id || null),
        podium: orderedRaceResults
          .filter((result) => {
            const position = toPositionNumber(result.position);
            return position !== null && position >= 1 && position <= 3 && result.driver_id;
          })
          .slice(0, 3)
          .map((result) => ({
            position: toPositionNumber(result.position) || 0,
            driverId: result.driver_id || '',
            driverName: formatDriverName(result.driver_id ? driverById.get(result.driver_id) : null, result.driver_id) || '-',
            constructorId: result.constructor_id,
            constructorName: result.constructor_id
              ? constructorById.get(result.constructor_id)?.name || result.constructor_id
              : null,
          })),
      };
    });
}

export function buildInterruptionProbabilities(
  analyticsRows: Array<Pick<FastF1SessionAnalyticsRow, 'payload'>>,
): TrackInterruptionProbability[] {
  const sampleSize = analyticsRows.length;

  return (Object.keys(INTERRUPTION_LABELS) as TrackInterruptionProbability['type'][]).map((type) => {
    const triggeredCount = analyticsRows.filter((row) =>
      (row.payload.trackStatusPeriods || []).some((period) => period.type === type),
    ).length;

    return {
      type,
      label: INTERRUPTION_LABELS[type],
      sampleSize,
      triggeredCount,
      probabilityPct: percentage(triggeredCount, sampleSize),
      status: sampleSize >= 1 ? 'ok' : 'insufficient-data',
    };
  });
}

export function buildRacePreviewSummary(params: {
  season: number;
  round: number;
  circuitId: string;
  races: RaceSummaryRow[];
  raceResults: RaceResultSummaryRow[];
  qualifyingResults: QualifyingResultSummaryRow[];
  drivers?: DriverNameRow[];
  constructors?: ConstructorNameRow[];
  analyticsRows?: Array<Pick<FastF1SessionAnalyticsRow, 'payload'>>;
}): RacePreviewSummary {
  const recentResults = buildRecentGrandPrixResults(
    params.races,
    params.raceResults,
    params.qualifyingResults,
    params.drivers,
    params.constructors,
  );
  const poleWinCount = recentResults.filter((race) =>
    race.winnerDriverId && race.poleDriverId && race.winnerDriverId === race.poleDriverId,
  ).length;
  const poleSamples = recentResults.filter((race) => race.winnerDriverId && race.poleDriverId).length;

  return {
    season: params.season,
    round: params.round,
    circuitId: params.circuitId,
    recentResults,
    interruptionProbabilities: buildInterruptionProbabilities(params.analyticsRows || []),
    poleWinConversionPct: percentage(poleWinCount, poleSamples),
    sampleSize: recentResults.length,
  };
}

export function buildDriverTelemetrySummary(
  telemetryDriver: FastF1TelemetryDriver,
): DriverPostRaceTelemetrySummary {
  const samples = telemetryDriver.samples || [];
  const speedValues = samples
    .map((sample) => sample.speedKph)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const throttleValues = samples
    .map((sample) => sample.throttlePct)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const brakeSamples = samples.filter((sample) => sample.brake);
  const drsSamples = samples.filter((sample) => sample.drs !== null && sample.drs > 0);

  return {
    driver: telemetryDriver.driver,
    team: telemetryDriver.team,
    lapNumber: telemetryDriver.lapNumber,
    lapTimeSeconds: telemetryDriver.lapTimeSeconds,
    maxSpeedKph: speedValues.length ? round(Math.max(...speedValues), 1) : null,
    avgSpeedKph: round(average(speedValues), 1),
    fullThrottlePct: throttleValues.length
      ? round((throttleValues.filter((value) => value >= 99).length / throttleValues.length) * 100, 1)
      : null,
    avgThrottlePct: round(average(throttleValues), 1),
    brakePct: samples.length ? round((brakeSamples.length / samples.length) * 100, 1) : null,
    drsPct: samples.length ? round((drsSamples.length / samples.length) * 100, 1) : null,
  };
}

export function buildPostRaceTelemetrySummary(
  analytics: FastF1RaceAnalytics | null | undefined,
): DriverPostRaceTelemetrySummary[] {
  if (!analytics) {
    return [];
  }

  if (analytics.telemetrySummary?.length) {
    return analytics.telemetrySummary;
  }

  return (analytics.telemetry?.drivers || []).map(buildDriverTelemetrySummary);
}

async function getRowsByIds<T extends { race_id: number }>(table: string, raceIds: number[]) {
  if (!raceIds.length) {
    return [] as T[];
  }

  const query = supabase
    .from(table)
    .select('race_id, driver_id, constructor_id, position')
    .in('race_id', raceIds);
  const { data, error } = await measureRequest('supabase', `${table}.getRowsByRaceIds`, async () => query);

  if (error) {
    throw error;
  }

  return (data || []) as T[];
}

async function getNameRows<T>(
  table: string,
  idColumn: string,
  ids: string[],
  columns: string,
) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (!uniqueIds.length) {
    return [] as T[];
  }

  const query = supabase
    .from(table)
    .select(columns)
    .in(idColumn, uniqueIds);
  const { data, error } = await measureRequest('supabase', `${table}.getNameRows`, async () => query);

  if (error) {
    throw error;
  }

  return (data || []) as T[];
}

async function getFastF1RowsForRaces(races: RaceSummaryRow[]) {
  if (!races.length) {
    return [] as FastF1SessionAnalyticsRow[];
  }

  let databaseRows: FastF1SessionAnalyticsRow[] = [];
  const filter = races.map((race) => `and(season.eq.${race.season},round.eq.${race.round})`).join(',');
  const query = supabase
    .from('fastf1_session_analytics')
    .select('season, round, payload')
    .eq('session', 'R')
    .or(filter);
  const { data, error } = await measureRequest('supabase', 'fastf1_session_analytics.getRowsForRaces', async () => query);

  if (!error) {
    databaseRows = (data || []) as FastF1SessionAnalyticsRow[];
  }

  const existingKeys = new Set(databaseRows.map((row) => `${row.season}-${row.round}`));
  const missingRaces = races.filter((race) => !existingKeys.has(`${race.season}-${race.round}`));
  const staticRows = await Promise.all(missingRaces.map(async (race) => {
    return getStaticFastF1Row(race.season, race.round);
  }));

  return [
    ...databaseRows,
    ...staticRows.filter((row): row is FastF1SessionAnalyticsRow => Boolean(row)),
  ];
}

async function getCircuitHistoryRaces(params: {
  circuitIdCandidates: string[];
  seasonNumber: number;
  roundNumber: number;
  limit: number;
  minSeason?: number;
}) {
  let query = supabase
    .from('races')
    .select('id, season, round, race_name, circuit_id, date')
    .in('circuit_id', params.circuitIdCandidates)
    .or(`season.lt.${params.seasonNumber},and(season.eq.${params.seasonNumber},round.lt.${params.roundNumber})`);

  if (typeof params.minSeason === 'number') {
    query = query.gte('season', params.minSeason);
  }

  query = query
    .order('season', { ascending: false })
    .order('round', { ascending: false })
    .limit(params.limit);

  const { data, error } = await measureRequest('supabase', 'races.getRacePreviewHistory', async () => query);

  if (error) {
    throw error;
  }

  return (data || []) as RaceSummaryRow[];
}

export const raceWeekendAnalyticsApi = {
  async getRacePreviewSummary(
    season: string,
    round: string,
    circuitId: string,
  ): Promise<RacePreviewSummary | null> {
    const seasonNumber = Number(season);
    const roundNumber = Number(round);

    if (!circuitId || !Number.isFinite(seasonNumber) || !Number.isFinite(roundNumber)) {
      return null;
    }

    const circuitIdCandidates = getCircuitIdCandidates(circuitId);
    const [races, interruptionRaces] = await Promise.all([
      getCircuitHistoryRaces({
        circuitIdCandidates,
        seasonNumber,
        roundNumber,
        limit: RECENT_RESULTS_HISTORY_LIMIT,
      }),
      getCircuitHistoryRaces({
        circuitIdCandidates,
        seasonNumber,
        roundNumber,
        limit: INTERRUPTION_HISTORY_LIMIT,
        minSeason: seasonNumber - INTERRUPTION_LOOKBACK_SEASONS,
      }),
    ]);
    const raceIds = races.map((race) => race.id);
    const [raceResults, qualifyingResults, fastF1Rows, currentFastF1Row] = await Promise.all([
      getRowsByIds<RaceResultSummaryRow>('race_results', raceIds),
      getRowsByIds<QualifyingResultSummaryRow>('qualifying_results', raceIds),
      getFastF1RowsForRaces(interruptionRaces),
      getStaticFastF1Row(seasonNumber, roundNumber),
    ]);
    const driverIds = [
      ...raceResults.map((result) => result.driver_id),
      ...qualifyingResults.map((result) => result.driver_id),
    ].filter((value): value is string => Boolean(value));
    const constructorIds = raceResults
      .map((result) => result.constructor_id)
      .filter((value): value is string => Boolean(value));
    const [drivers, constructors] = await Promise.all([
      getNameRows<DriverNameRow>('drivers', 'driver_id', driverIds, 'driver_id, first_name, last_name, code'),
      getNameRows<ConstructorNameRow>('constructors', 'constructor_id', constructorIds, 'constructor_id, name'),
    ]);

    return buildRacePreviewSummary({
      season: seasonNumber,
      round: roundNumber,
      circuitId: getSupabaseCircuitId(circuitId),
      races,
      raceResults,
      qualifyingResults,
      drivers,
      constructors,
      analyticsRows: currentFastF1Row ? [currentFastF1Row, ...fastF1Rows] : fastF1Rows,
    });
  },
};
