import type { Circuit, Driver, DriverStanding } from './index';

export interface SupabaseDriverListRow {
  driver_id: string;
  total_wins: number | null;
  total_pole_positions: number | null;
  total_fastest_laps: number | null;
  total_race_starts: number | null;
}

export interface SupabaseDriverDetailRow extends SupabaseDriverListRow {
  permanent_number: string | null;
  code: string | null;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  nationality: string | null;
  total_podiums: number | null;
}

export interface SupabaseConstructorDetailRow {
  constructor_id: string;
  name: string | null;
  nationality: string | null;
  total_wins: number | null;
  total_podiums: number | null;
  total_pole_positions: number | null;
  total_fastest_laps: number | null;
  total_race_entries: number | null;
}

export interface SupabaseCircuitListRow {
  circuit_id: string;
  length: string | number | null;
  turns: string | number | null;
  first_race: string | number | null;
  total_races: string | number | null;
  race_laps: string | number | null;
  total_distance: string | number | null;
  lap_record: string | null;
  lap_record_driver: string | null;
  lap_record_year: string | number | null;
}

export type DriverDetails = Partial<Omit<Driver, 'code' | 'nationality'>> & Partial<SupabaseDriverDetailRow> & {
  code?: string | null;
  nationality?: string | null;
  standing: DriverStanding | null;
};

export type CircuitRouteState = {
  circuit?: Circuit;
};
