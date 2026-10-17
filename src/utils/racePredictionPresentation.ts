import type { RacePredictionPhase, RaceWinnerPrediction } from '@/types/racePrediction';

export const RACE_PREDICTION_FRESH_MS = 6 * 60 * 60 * 1000;

const PHASE_LABELS: Record<RacePredictionPhase, string> = {
  pre_weekend: '\u8d5b\u524d\u9884\u6d4b',
  post_quali: '\u6392\u4f4d\u8d5b\u540e',
};

export function getRacePredictionPhaseLabel(phase: RacePredictionPhase): string {
  return PHASE_LABELS[phase];
}

export function isRacePredictionFresh(
  prediction: Pick<RaceWinnerPrediction, 'generatedAt'>,
  now = Date.now(),
): boolean {
  const generatedAt = Date.parse(prediction.generatedAt);
  return Number.isFinite(generatedAt)
    && now >= generatedAt
    && now - generatedAt <= RACE_PREDICTION_FRESH_MS;
}

export function formatPredictionProbability(probability: number): string {
  return `${Math.round(Math.max(0, Math.min(1, probability)) * 100)}%`;
}

export function formatPredictionDriverId(driverId: string): string {
  return driverId
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
