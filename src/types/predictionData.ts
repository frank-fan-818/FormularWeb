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

export interface PredictionSeasonRaceData {
  season: number;
  round: number;
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
