export interface PredictionRaceResultData {
  position: number;
  driverId: string;
  constructorId: string;
  points: number;
  gridPosition: number;
  laps: number;
  status: string;
}

export interface PredictionQualifyingResultData {
  position: number;
  driverId: string;
  constructorId: string;
  q1: string | null;
  q2: string | null;
  q3: string | null;
}

export interface PredictionPreRaceObservation {
  observedAt: string;
  source: string;
  entries: Array<{ driverId: string; constructorId: string; gridPosition?: number }>;
}

export interface PredictionSeasonRaceData {
  season: number;
  round: number;
  raceStartAt?: string;
  preRaceObservations?: PredictionPreRaceObservation[];
  raceName: string;
  circuitId: string;
  isSprintWeekend: boolean;
  results: PredictionRaceResultData[];
  qualifying: PredictionQualifyingResultData[];
  sprintResults: PredictionRaceResultData[];
  sprintQualifying: PredictionQualifyingResultData[];
}

export interface PredictionSeasonSnapshot {
  schemaVersion: 1;
  season: number;
  races: PredictionSeasonRaceData[];
}
