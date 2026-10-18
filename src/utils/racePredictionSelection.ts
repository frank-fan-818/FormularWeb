import type { PhasePredictionModel, PredictionBacktestRace } from '@/types/racePredictionModel';
import { summarizePredictionScores } from './racePredictionTraining';

export function rawPredictionScores(rows: PredictionBacktestRace[]): PredictionBacktestRace[] {
  return rows.map((row) => ({ ...row, logLoss: row.rawLogLoss, brierScore: row.rawBrierScore }));
}

export function selectPredictionRecipe(choices: Array<{ name: string; model: PhasePredictionModel }>, validationThroughSeason: number) {
  const baseline = choices.find((choice) => choice.name === 'baseline') || choices[0];
  if (!baseline) throw new Error('Missing prediction recipe candidates');
  const validationRows = (model: PhasePredictionModel) => model.backtest.races.filter((row) => row.season <= validationThroughSeason);
  const baselineMetrics = summarizePredictionScores(rawPredictionScores(validationRows(baseline.model)));
  let selected = baseline;
  let selectedMetrics = baselineMetrics;
  for (const choice of choices) {
    const metrics = summarizePredictionScores(rawPredictionScores(validationRows(choice.model)));
    if (metrics.raceCount === baselineMetrics.raceCount && metrics.raceCount > 0 &&
      metrics.top1Accuracy >= baselineMetrics.top1Accuracy && metrics.logLoss < selectedMetrics.logLoss - 1e-8) {
      selected = choice; selectedMetrics = metrics;
    }
  }
  const calibrated = summarizePredictionScores(validationRows(selected.model));
  return { name: selected.name, ...selected.model.recipe,
    calibration: calibrated.raceCount >= 12 && calibrated.logLoss < selectedMetrics.logLoss && calibrated.brierScore <= selectedMetrics.brierScore,
    validation: { raw: selectedMetrics, calibrated }, validationThroughSeason };
}

export function assessPredictionPromotion(champion: PhasePredictionModel, candidate: PhasePredictionModel) {
  const prior = summarizePredictionScores(champion.backtest.races);
  const next = summarizePredictionScores(candidate.backtest.races);
  const prior2026 = summarizePredictionScores(champion.backtest.races.filter((row) => row.season === 2026));
  const next2026 = summarizePredictionScores(candidate.backtest.races.filter((row) => row.season === 2026));
  const reasons: string[] = [];
  if (prior.raceCount !== next.raceCount || prior2026.raceCount !== next2026.raceCount) reasons.push('Incomparable race coverage');
  if (next.top1Accuracy < prior.top1Accuracy || next2026.top1Accuracy < prior2026.top1Accuracy) reasons.push('Known top-1 regression');
  if (next.top3Accuracy < prior.top3Accuracy || next2026.top3Accuracy < prior2026.top3Accuracy) reasons.push('Known top-3 regression');
  if (next.winnerCoverage < prior.winnerCoverage) reasons.push('Winner roster coverage regression');
  if (next.logLoss >= prior.logLoss || next.brierScore > prior.brierScore) reasons.push('No improvement in probability errors');
  return { approved: reasons.length === 0, reasons };
}

export function withoutPredictionCalibration(model: PhasePredictionModel): PhasePredictionModel {
  const rows = model.backtest.races.map((row) => ({ ...row, logLoss: row.rawLogLoss, brierScore: row.rawBrierScore,
    winnerProbability: row.rawWinnerProbability, temperature: 1, calibrationRaceKeys: [] }));
  return { ...model, calibration: { method: 'temperature', enabled: false, temperature: 1, sampleCount: 0, raceKeys: [] },
    backtest: { ...model.backtest, races: rows, metrics: summarizePredictionScores(rows),
      bySeason: Object.fromEntries([...new Set(rows.map((row) => row.season))].map((season) => [String(season), summarizePredictionScores(rows.filter((row) => row.season === season))])) } };
}
