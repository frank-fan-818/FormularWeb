import { z } from 'zod';
import type { DriverHistorySummaryRecord } from '../types';
import type { VerifiedDriverAddition } from '../types/verifiedDrivers';

const date = z.iso.date();
const rowSchema: z.ZodType<VerifiedDriverAddition> = z.object({
  driverId: z.string().regex(/^[a-z][a-z0-9_]*$/),
  upstreamId: z.string().regex(/^[a-z][a-z0-9_]*$/),
  givenName: z.string().trim().min(1), familyName: z.string().trim().min(1),
  dateOfBirth: date.nullable(), nationality: z.string().trim().min(1),
  entryCount: z.number().int().nonnegative(),
  participationStatus: z.enum(['entered_without_start', 'test_reserve']),
  participationNote: z.string().trim().min(1), verificationNotes: z.string(),
  recentConstructorId: z.string().nullable(), recentConstructorName: z.string().nullable(),
  sourceUrls: z.array(z.url().refine(url => new URL(url).protocol === 'https:')).min(2)
    .refine(urls => urls.some(url => new URL(url).hostname !== 'api.jolpi.ca'), 'Independent verification source required'),
}).strict();

export function buildVerifiedDriverAdditions(input: unknown) {
  const manifest = z.object({ verifiedAt: date, drivers: z.array(rowSchema).min(1) }).strict().parse(input);
  const ids = new Set<string>();
  const upstreamIds = new Set<string>();
  const names = new Set<string>();
  for (const driver of manifest.drivers) {
    const name = `${driver.givenName} ${driver.familyName}`.normalize('NFKD').toLowerCase();
    if (ids.has(driver.driverId) || upstreamIds.has(driver.upstreamId) || names.has(name)) throw new Error('Duplicate verified driver identity');
    ids.add(driver.driverId);
    upstreamIds.add(driver.upstreamId);
    names.add(name);
    if (driver.participationStatus === 'test_reserve' ? driver.entryCount !== 0 : driver.entryCount === 0) {
      throw new Error(`Inconsistent entry count for ${driver.driverId}`);
    }
  }
  const drivers = manifest.drivers.map(driver => ({
    driver_id: driver.driverId, first_name: driver.givenName, last_name: driver.familyName,
    date_of_birth: driver.dateOfBirth, nationality: driver.nationality,
    code: null, permanent_number: null,
    total_race_entries: driver.entryCount, total_race_starts: 0,
    total_wins: 0, total_podiums: 0, total_pole_positions: 0, total_fastest_laps: 0,
    total_championships: 0, total_points: 0, best_race_finish_position: null,
  }));
  const summaries: DriverHistorySummaryRecord[] = manifest.drivers.map(driver => ({
    driver_id: driver.driverId, given_name: driver.givenName, family_name: driver.familyName,
    date_of_birth: driver.dateOfBirth, nationality: driver.nationality,
    permanent_number: null, code: null, url: driver.sourceUrls.find(url => !url.includes('api.jolpi.ca'))!,
    recent_constructor_id: driver.recentConstructorId, recent_constructor_name: driver.recentConstructorName,
    career_summary: {
      raceCount: 0, poleCount: 0, winCount: 0, podiumCount: 0, championshipCount: 0, totalPoints: 0,
      entryCount: driver.entryCount, participationStatus: driver.participationStatus,
      participationNote: driver.participationNote, verifiedAt: manifest.verifiedAt,
      verificationSources: driver.sourceUrls, verificationNotes: driver.verificationNotes,
    },
    best_race_finish: null, seasons: [],
  }));
  return { manifest, drivers, summaries };
}

export function preserveVerifiedDriverSummaries(rows: DriverHistorySummaryRecord[], input: unknown): DriverHistorySummaryRecord[] {
  const verified = new Map(buildVerifiedDriverAdditions(input).summaries.map(row => [row.driver_id, row]));
  return rows.map(row => {
    const metadata = verified.get(row.driver_id);
    const career = row.career_summary;
    if (!metadata || !career || typeof career !== 'object' || Array.isArray(career)
      || !Object.values(career).every(value => value === 0)
      || !Array.isArray(row.seasons) || row.seasons.length > 0 || row.best_race_finish != null) return row;
    return {
      ...row,
      url: metadata.url,
      recent_constructor_id: row.recent_constructor_id ?? metadata.recent_constructor_id,
      recent_constructor_name: row.recent_constructor_name ?? metadata.recent_constructor_name,
      career_summary: metadata.career_summary,
    };
  });
}
