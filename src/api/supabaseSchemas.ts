import { z } from 'zod';
import type {
  ConstructorHistorySummaryRecord,
  DriverHistorySummaryRecord,
  SupabaseCircuitDetailRow,
  SupabaseCircuitListRow,
  SupabaseConstructorDetailRow,
  SupabaseConstructorListRow,
  SupabaseDriverDetailRow,
  SupabaseDriverListRow,
} from '@/types';

const nullableText = z.string().nullable();
const nullableNumber = z.number().finite().nullable();
const nullableScalar = z.union([z.string(), z.number()]).nullable();

export const SupabaseRowSchema = z.record(z.string(), z.unknown());

export const SupabaseDriverListRowSchema: z.ZodType<SupabaseDriverListRow> = z.object({
  driver_id: z.string().min(1),
  total_wins: nullableNumber,
  total_pole_positions: nullableNumber,
  total_fastest_laps: nullableNumber,
  total_race_starts: nullableNumber,
}).passthrough();

export const SupabaseDriverDetailRowSchema: z.ZodType<SupabaseDriverDetailRow> = SupabaseDriverListRowSchema.and(z.object({
  permanent_number: nullableText,
  code: nullableText,
  first_name: nullableText,
  last_name: nullableText,
  date_of_birth: nullableText,
  nationality: nullableText,
  total_podiums: nullableNumber,
}));

export const SupabaseConstructorListRowSchema: z.ZodType<SupabaseConstructorListRow> = z.object({
  constructor_id: z.string().min(1),
  nationality: nullableText,
  total_wins: nullableNumber,
  total_pole_positions: nullableNumber,
  total_fastest_laps: nullableNumber,
  total_race_entries: nullableNumber,
}).passthrough();

export const SupabaseConstructorDetailRowSchema: z.ZodType<SupabaseConstructorDetailRow> = SupabaseConstructorListRowSchema.and(z.object({
  name: nullableText,
  total_podiums: nullableNumber,
}));

export const SupabaseCircuitListRowSchema: z.ZodType<SupabaseCircuitListRow> = z.object({
  circuit_id: z.string().min(1),
  length: nullableScalar,
  turns: nullableScalar,
  first_race: nullableScalar,
  total_races: nullableScalar,
  race_laps: nullableScalar,
  total_distance: nullableScalar,
  lap_record: nullableText,
  lap_record_driver: nullableText,
  lap_record_year: nullableScalar,
}).passthrough();

export const SupabaseCircuitDetailRowSchema: z.ZodType<SupabaseCircuitDetailRow> = SupabaseCircuitListRowSchema.and(z.object({
  name: nullableText,
  locality: nullableText,
  country: nullableText,
  lat: nullableScalar,
  long: nullableScalar,
}));

export const DriverHistorySummaryRecordSchema: z.ZodType<DriverHistorySummaryRecord> = z.object({
  driver_id: z.string().min(1),
  permanent_number: nullableText,
  code: nullableText,
  url: nullableText,
  given_name: nullableText,
  family_name: nullableText,
  date_of_birth: nullableText,
  nationality: nullableText,
  recent_constructor_name: nullableText,
  recent_constructor_id: nullableText,
  career_summary: z.record(z.string(), z.unknown()),
  best_race_finish: z.record(z.string(), z.unknown()).nullable(),
  seasons: z.array(z.unknown()),
  updated_at: nullableText.optional(),
}).passthrough();

export const ConstructorHistorySummaryRecordSchema: z.ZodType<ConstructorHistorySummaryRecord> = z.object({
  constructor_id: z.string().min(1),
  url: nullableText,
  name: nullableText,
  nationality: nullableText,
  career_summary: z.record(z.string(), z.unknown()),
  best_race_finish: z.record(z.string(), z.unknown()).nullable(),
  seasons: z.array(z.unknown()),
  updated_at: nullableText.optional(),
}).passthrough();
