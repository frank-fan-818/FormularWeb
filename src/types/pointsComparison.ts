export type PointsComparisonKind = 'driver' | 'constructor';

export interface PointsComparisonEntry {
  id: string;
  name: string;
  color: string;
}

export interface PointsSnapshot {
  round: number;
  points: Record<string, number>;
}

export interface PointsLoadingProgress {
  completed: number;
  total: number;
}

export interface SeasonPointsProgress {
  latest: PointsSnapshot;
  rounds: Array<{ round: number; name: string; snapshot: PointsSnapshot | null }>;
}
