export interface RaceFormWindow {
  raceCount: number;
  winRate: number;
  podiumRate: number;
  averageFinish: number;
  reliabilityRate: number;
}

export interface RaceFormWindows {
  short: RaceFormWindow;
  recent: RaceFormWindow;
  long: RaceFormWindow;
}

export type PredictionFeatureSet = 'baseline' | 'windows' | 'windows_circuit';
export type PredictionWeighting = 'equal' | 'recent' | 'season';
