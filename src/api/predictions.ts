import { z } from 'zod';
import { supabase } from '@/utils/supabase';
import { measureRequest } from '@/utils/performance';
import type { RaceWinnerPrediction } from '@/types/racePrediction';

const factorSchema = z.object({
  feature: z.string().min(1),
  contribution: z.coerce.number().finite(),
});

const candidateSchema = z.object({
  driver_id: z.string().min(1),
  constructor_id: z.string().min(1),
  rank: z.coerce.number().int().positive(),
  probability: z.coerce.number().min(0).max(1),
  factors: z.array(factorSchema).default([]),
});

const predictionRowSchema = z.object({
  run_id: z.string().uuid(),
  season: z.coerce.number().int().min(1950),
  round: z.coerce.number().int().positive(),
  race_name: z.string().min(1),
  phase: z.enum(['pre_weekend', 'post_quali']),
  model_version: z.string().min(1),
  generated_at: z.string().datetime({ offset: true }),
  data_cutoff_at: z.string().datetime({ offset: true }),
  candidates: z.array(candidateSchema),
});

export function mapRacePredictionRow(row: unknown): RaceWinnerPrediction {
  const parsed = predictionRowSchema.parse(row);
  return {
    runId: parsed.run_id,
    season: parsed.season,
    round: parsed.round,
    raceName: parsed.race_name,
    phase: parsed.phase,
    modelVersion: parsed.model_version,
    generatedAt: parsed.generated_at,
    dataCutoffAt: parsed.data_cutoff_at,
    candidates: parsed.candidates.map((candidate) => ({
      driverId: candidate.driver_id,
      constructorId: candidate.constructor_id,
      rank: candidate.rank,
      probability: candidate.probability,
      factors: candidate.factors,
    })),
  };
}

export const predictionsApi = {
  async getRacePrediction(season: string | number, round: string | number): Promise<RaceWinnerPrediction | null> {
    const seasonNumber = Number(season);
    const roundNumber = Number(round);
    if (!Number.isInteger(seasonNumber) || !Number.isInteger(roundNumber)) return null;

    const query = supabase
      .from('race_prediction_current')
      .select('*')
      .eq('season', seasonNumber)
      .eq('round', roundNumber)
      .maybeSingle();
    const { data, error } = await measureRequest('supabase', 'race_prediction_current.getRace', async () => query);
    if (error) throw error;
    return data ? mapRacePredictionRow(data) : null;
  },
};
