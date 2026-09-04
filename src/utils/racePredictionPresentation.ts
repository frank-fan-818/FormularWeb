import type { RacePredictionPhase, RaceWinnerPrediction } from '@/types/racePrediction';

export const RACE_PREDICTION_FRESH_MS = 6 * 60 * 60 * 1000;

const PHASE_LABELS: Record<RacePredictionPhase, string> = {
  pre_weekend: '\u8d5b\u524d\u9884\u6d4b',
  post_quali: '\u6392\u4f4d\u8d5b\u540e',
};

const FACTOR_LABELS: Record<string, string> = {
  qualifyingPole: '\u6746\u4f4d',
  qualifyingAdvantage: '\u6392\u4f4d\u8d5b\u8868\u73b0',
  qualifyingPaceAdvantage: '\u5355\u5708\u901f\u5ea6',
  gridAdvantage: '\u53d1\u8f66\u4f4d\u7f6e',
  gridFrontRow: '\u5934\u6392\u53d1\u8f66',
  gridTop3: '\u524d\u4e09\u53d1\u8f66',
  driverRecentWinRate: '\u8f66\u624b\u8fd1\u671f\u80dc\u7387',
  constructorRecentWinRate: '\u8f66\u961f\u8fd1\u671f\u80dc\u7387',
  driverStandingAdvantage: '\u8f66\u624b\u79ef\u5206\u699c',
  constructorStandingAdvantage: '\u8f66\u961f\u79ef\u5206\u699c',
  sprintFinishAdvantage: '\u51b2\u523a\u8d5b\u8868\u73b0',
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

export function getPredictionFactorLabel(feature: string): string {
  return FACTOR_LABELS[feature] || feature.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
}
