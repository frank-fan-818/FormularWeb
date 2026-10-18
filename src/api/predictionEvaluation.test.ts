import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { evaluateStoredRacePredictions } from './predictionEvaluation';
import type { PredictionSeasonRaceData } from '@/types/predictionData';

const race: PredictionSeasonRaceData = { season: 2026, round: 1, raceName: 'GP', circuitId: 'test',
  raceStartAt: '2026-03-01T12:00:00Z', isSprintWeekend: false,
  results: [{ driverId: 'd0', constructorId: 'c', position: 1, points: 25, gridPosition: 1, laps: 50, status: 'Finished' }],
  qualifying: [], sprintResults: [], sprintQualifying: [] };
const run = (id: string) => ({ id, season: 2026, round: 1, race_name: 'GP', phase: 'pre_weekend', model_version: 'model',
  generated_at: '2026-02-28T12:00:00Z', data_cutoff_at: '2026-02-28T12:00:00Z',
  prediction_candidates: Array.from({ length: 16 }, (_, index) => ({ driver_id: `d${index}`, constructor_id: 'c', rank: index + 1,
    probability: index === 0 ? 0.4 : 0.6 / 15 })) });

function database(error: object | null = null) {
  const writes = vi.fn(async () => ({ error: null }));
  const range = vi.fn(async (offset: number) => ({ data: offset === 0 ? [run('first')] : offset === 1 ? [run('second')] : [], error }));
  const read = { select: () => read, eq: () => read, order: () => read, range };
  const from = vi.fn((table: string) => table === 'prediction_runs' ? read : { upsert: writes });
  return { client: { from } as unknown as SupabaseClient, writes, from, range };
}

describe('stored forecast evaluation transport', () => {
  it('paginates original runs and writes only idempotent score records', async () => {
    const db = database();
    const result = await evaluateStoredRacePredictions(db.client, 2026, [race]);
    expect(result.checkedRuns).toBe(2);
    expect(result.scores.map((row) => row.runId)).toEqual(['first', 'second']);
    expect(db.range.mock.calls.map((args) => args[0])).toEqual([0, 1, 2]);
    expect(db.writes).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ run_id: 'first', winner_probability: 0.4 })]), { onConflict: 'run_id' });
    expect(db.from.mock.calls.every(([table]) => ['prediction_runs', 'prediction_evaluations'].includes(table))).toBe(true);
  });
  it('keeps dry runs read-only and propagates database failures', async () => {
    const db = database();
    await evaluateStoredRacePredictions(db.client, 2026, [race], true);
    expect(db.writes).not.toHaveBeenCalled();
    const failed = database({ message: 'denied' });
    await expect(evaluateStoredRacePredictions(failed.client, 2026, [race])).rejects.toMatchObject({ message: 'denied' });
  });
});
