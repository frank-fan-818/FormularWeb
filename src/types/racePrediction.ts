export type RacePredictionPhase = 'pre_weekend' | 'post_quali';

export interface RacePredictionCandidate {
  driverId: string;
  constructorId: string;
  rank: number;
  probability: number;
  factors: Array<{
    feature: string;
    contribution: number;
  }>;
}

export interface RaceWinnerPrediction {
  runId: string;
  season: number;
  round: number;
  raceName: string;
  phase: RacePredictionPhase;
  modelVersion: string;
  generatedAt: string;
  dataCutoffAt: string;
  candidates: RacePredictionCandidate[];
}
