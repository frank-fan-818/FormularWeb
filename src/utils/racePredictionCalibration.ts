export interface PredictionCalibrationCase { probabilities: number[]; winnerIndex: number }

export function applyPredictionTemperature(probabilities: number[], temperature: number): number[] {
  if (!Number.isFinite(temperature) || temperature <= 0) throw new Error('Temperature must be finite and positive');
  if (temperature === 1) return [...probabilities];
  const scores = probabilities.map((probability) => probability > 0 ? Math.log(probability) / temperature : -Infinity);
  const max = Math.max(...scores);
  const exps = scores.map((score) => Math.exp(score - max));
  const total = exps.reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(total) || total <= 0) throw new Error('Invalid prediction probabilities');
  return exps.map((value) => value / total);
}

/** Input must be earlier out-of-fold forecasts, not in-sample model probabilities. */
export function fitPredictionTemperature(cases: PredictionCalibrationCase[], minimumSamples = 12) {
  const valid = cases.filter((row) => Number.isInteger(row.winnerIndex) && row.winnerIndex >= 0 && row.winnerIndex < row.probabilities.length);
  let temperature = 1;
  const loss = (value: number) => valid.reduce((sum, row) => sum - Math.log(Math.max(applyPredictionTemperature(row.probabilities, value)[row.winnerIndex], 1e-12)), 0);
  if (valid.length >= minimumSamples) {
    let bestLoss = loss(1);
    for (const candidate of [0.5, 0.75, 1.25, 1.5, 2, 3]) {
      const candidateLoss = loss(candidate);
      if (candidateLoss < bestLoss - 1e-8) { temperature = candidate; bestLoss = candidateLoss; }
    }
  }
  return { temperature, sampleCount: valid.length };
}
