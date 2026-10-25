export interface AwardStanding { rank: number; team: string; points: number }
export interface AwardStop {
  id: string; rank: number; driver: string; code: string; team: string;
  lap: number | null; duration: string; points: number; irregular: boolean; notes: string;
}
export interface PitRecord {
  driverId: string; driver: string; code: string; team: string; constructorId: string;
  lap: number; stop: number; laneDuration: string; stopDuration: string | null;
  laneSource: string; stopSource: string | null;
}
export interface AwardData {
  season: string; seasons: number[]; source: string; updatedAt: string; stale: boolean;
  standings: AwardStanding[]; stops: AwardStop[]; unavailable?: boolean; event?: string;
}
export interface RacePitData { season: string; records: PitRecord[]; updatedAt: string; stale: boolean; partial?: boolean }
