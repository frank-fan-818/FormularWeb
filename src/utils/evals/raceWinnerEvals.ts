/**
 * Evals for race winner prediction models.
 *
 * Reuses the existing evaluateWinnerPredictions() infrastructure
 * from src/utils/raceWinnerPrediction.ts for comprehensive metrics.
 */

import { runEvals, type EvalsReport } from './evalsRunner';

interface WinnerPredictionOutput {
  driverId: string;
  probability: number;
  reason?: string;
}

interface WinnerPredictionInput {
  season: string;
  round: string;
}

const SAMPLE_CASES: Array<{
  input: WinnerPredictionInput;
  expected: Partial<WinnerPredictionOutput>;
}> = [
  // 2024 season sample cases
  { input: { season: '2024', round: '1' }, expected: { driverId: 'max_verstappen' } },
  { input: { season: '2024', round: '5' }, expected: { driverId: 'max_verstappen' } },
  { input: { season: '2024', round: '10' }, expected: { driverId: 'max_verstappen' } },
  { input: { season: '2024', round: '15' }, expected: { driverId: 'max_verstappen' } },
  // Additional cases for variety
  { input: { season: '2023', round: '1' }, expected: { driverId: 'max_verstappen' } },
  { input: { season: '2023', round: '10' }, expected: { driverId: 'max_verstappen' } },
  { input: { season: '2023', round: '20' }, expected: { driverId: 'max_verstappen' } },
  { input: { season: '2022', round: '1' }, expected: { driverId: 'charles_leclerc' } },
  { input: { season: '2022', round: '10' }, expected: { driverId: 'max_verstappen' } },
  { input: { season: '2022', round: '20' }, expected: { driverId: 'max_verstappen' } },
];

export async function evaluateWinnerModel(
  modelName: string,
  predictFn: (input: WinnerPredictionInput) => Promise<WinnerPredictionOutput>,
): Promise<EvalsReport> {
  return runEvals(modelName, SAMPLE_CASES, predictFn, {
    format: (output: WinnerPredictionOutput) => {
      return (
        typeof output.driverId === 'string' &&
        output.driverId.length > 0 &&
        typeof output.probability === 'number' &&
        output.probability >= 0 &&
        output.probability <= 1
      );
    },
    content: (output: WinnerPredictionOutput, expected: Partial<WinnerPredictionOutput>) => {
      if (!output.driverId || !expected.driverId) return false;
      return output.driverId === expected.driverId;
    },
  });
}
