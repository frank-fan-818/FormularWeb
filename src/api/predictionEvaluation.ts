import type { SupabaseClient } from '@supabase/supabase-js';
import type { PredictionSeasonRaceData } from '@/types/predictionData';
import type { RaceWinnerPrediction } from '@/types/racePrediction';
import { evaluatePublishedForecast, type PublishedPredictionScore } from '@/utils/racePredictionEvaluation';

export async function evaluateStoredRacePredictions(client: SupabaseClient, season: number, races: PredictionSeasonRaceData[], dryRun = false) {
  const raceByRound = new Map(races.filter((race) => race.season === season && race.results.some((row) => row.position === 1) &&
    Date.parse(race.raceStartAt || '') < Date.now()).map((race) => [race.round, race]));
  const scores: PublishedPredictionScore[] = [];
  let checkedRuns = 0;
  for (let offset = 0; ;) {
    const { data, error } = await client.from('prediction_runs')
      .select('id,season,round,race_name,phase,model_version,generated_at,data_cutoff_at,prediction_candidates(driver_id,constructor_id,rank,probability)')
      .eq('season', season).order('id').range(offset, offset + 99);
    if (error) throw error;
    if (!data?.length) break;
    for (const run of data) {
      checkedRuns += 1;
      const race = raceByRound.get(run.round);
      if (!race) continue;
      const forecast: RaceWinnerPrediction = { runId: run.id, season: run.season, round: run.round,
        raceName: run.race_name, phase: run.phase, modelVersion: run.model_version, generatedAt: run.generated_at, dataCutoffAt: run.data_cutoff_at,
        candidates: run.prediction_candidates.map((row) => ({ driverId: row.driver_id, constructorId: row.constructor_id,
          rank: row.rank, probability: row.probability, factors: [] })) };
      const score = evaluatePublishedForecast(forecast, race);
      if (score) scores.push(score);
    }
    offset += data.length;
  }
  if (!dryRun) {
    for (let offset = 0; offset < scores.length; offset += 100) {
      const { error } = await client.from('prediction_evaluations').upsert(scores.slice(offset, offset + 100).map((score) => ({
        run_id: score.runId, winner_driver_id: score.winnerDriverId, winner_in_field: score.winnerInField,
        winner_rank: score.winnerRank, winner_probability: score.winnerProbability, top1_hit: score.top1Hit, top3_hit: score.top3Hit,
        log_loss: score.logLoss, brier_score: score.brierScore, candidate_count: score.candidateCount,
      })), { onConflict: 'run_id' });
      if (error) throw error;
    }
  }
  return { checkedRuns, scores };
}
