import { measureRequest } from '@/utils/performance';
import type { RacePredictionCandidate, RacePredictionPhase, RaceWinnerPrediction } from '@/types/racePrediction';

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`Invalid ${field}`);
  return value;
}

function finiteNumber(value: unknown, field: string): number {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) throw new Error(`Invalid ${field}`);
  return number;
}

function positiveInteger(value: unknown, field: string, minimum = 1): number {
  const number = finiteNumber(value, field);
  if (!Number.isInteger(number) || number < minimum) throw new Error(`Invalid ${field}`);
  return number;
}

function timestamp(value: unknown, field: string): string {
  const text = requiredString(value, field);
  if (!/[zZ]|[+-]\d{2}:\d{2}$/.test(text) || !Number.isFinite(Date.parse(text))) {
    throw new Error(`Invalid ${field}`);
  }
  return text;
}

function mapCandidate(value: unknown): RacePredictionCandidate {
  if (!isRecord(value)) throw new Error('Invalid candidate');
  const probability = finiteNumber(value.probability, 'candidate probability');
  if (probability < 0 || probability > 1) throw new Error('Invalid candidate probability');
  const factors = value.factors === undefined ? [] : value.factors;
  if (!Array.isArray(factors)) throw new Error('Invalid candidate factors');
  return {
    driverId: requiredString(value.driver_id, 'driver id'),
    constructorId: requiredString(value.constructor_id, 'constructor id'),
    rank: positiveInteger(value.rank, 'candidate rank'),
    probability,
    factors: factors.map((factor) => {
      if (!isRecord(factor)) throw new Error('Invalid prediction factor');
      return {
        feature: requiredString(factor.feature, 'factor feature'),
        contribution: finiteNumber(factor.contribution, 'factor contribution'),
      };
    }),
  };
}

export function mapRacePredictionRow(row: unknown): RaceWinnerPrediction {
  if (!isRecord(row)) throw new Error('Invalid prediction row');
  const phase = row.phase;
  if (phase !== 'pre_weekend' && phase !== 'post_quali') throw new Error('Invalid prediction phase');
  if (!Array.isArray(row.candidates)) throw new Error('Invalid prediction candidates');
  return {
    runId: requiredString(row.run_id, 'run id'),
    season: positiveInteger(row.season, 'season', 1950),
    round: positiveInteger(row.round, 'round'),
    raceName: requiredString(row.race_name, 'race name'),
    phase: phase as RacePredictionPhase,
    modelVersion: requiredString(row.model_version, 'model version'),
    generatedAt: timestamp(row.generated_at, 'generated timestamp'),
    dataCutoffAt: timestamp(row.data_cutoff_at, 'data cutoff timestamp'),
    candidates: row.candidates.map(mapCandidate),
  };
}

export const predictionsApi = {
  async getRacePrediction(season: string | number, round: string | number): Promise<RaceWinnerPrediction | null> {
    const seasonNumber = Number(season);
    const roundNumber = Number(round);
    if (!Number.isInteger(seasonNumber) || !Number.isInteger(roundNumber)) return null;
    const baseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://example.supabase.co';
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';
    const url = new URL('/rest/v1/race_prediction_current', baseUrl);
    url.searchParams.set('select', '*');
    url.searchParams.set('season', `eq.${seasonNumber}`);
    url.searchParams.set('round', `eq.${roundNumber}`);
    url.searchParams.set('limit', '1');
    const response = await measureRequest('supabase', 'race_prediction_current.getRace', () => fetch(url, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    }));
    if (!response.ok) throw new Error(`Prediction request failed with status ${response.status}`);
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) throw new Error('Invalid prediction response');
    return rows.length > 0 ? mapRacePredictionRow(rows[0]) : null;
  },
};
