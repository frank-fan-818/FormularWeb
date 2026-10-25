import { z } from 'zod';
import type { AwardData, RacePitData } from '@/types/pitStops';

const seconds = z.string().refine(value => /^\d+(?:\.\d+)?$/.test(value) && Number(value) > 0);
const rank = z.number().int().positive();
const base = { season: z.string(), updatedAt: z.iso.datetime(), stale: z.boolean() };
const awardSchema = z.object({
  ...base, seasons: z.array(z.number().int()), source: z.url(), unavailable: z.boolean().optional(), event: z.string().optional(),
  standings: z.array(z.object({ rank, team: z.string(), points: z.number().nonnegative() })),
  seasonFastest: z.array(z.object({ id: z.string(), rank, driver: z.string().min(1), team: z.string().min(1), event: z.string().min(1), eventAbbreviation: z.string().min(1), duration: seconds })).default([]),
  stops: z.array(z.object({ id: z.string(), rank, driver: z.string(), code: z.string(), team: z.string(), lap: rank.nullable(), duration: seconds, points: z.number().nonnegative(), irregular: z.boolean(), notes: z.string() })),
});
const raceSchema = z.object({
  ...base, partial: z.boolean().optional(), records: z.array(z.object({
    driverId: z.string(), driver: z.string(), code: z.string(), team: z.string(), constructorId: z.string(),
    lap: rank, stop: rank, laneDuration: seconds, stopDuration: seconds.nullable(), laneSource: z.string(), stopSource: z.string().nullable(),
  })),
});
async function request(kind: string, season: string, round: string, signal: AbortSignal): Promise<unknown> {
  const query = new URLSearchParams({ kind, season });
  if (round) query.set('round', round);
  const response = await fetch(`/api/pit-stops?${query}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(35_000)]) });
  if (!response.ok) throw Error('Pit stop data unavailable');
  return response.json();
}
export async function getAwardData(season: string, round: string, signal: AbortSignal): Promise<AwardData> {
  const data = awardSchema.parse(await request('award', season, round, signal));
  if (data.season !== season) throw Error('Season mismatch');
  return data;
}
export async function getRacePitData(season: string, round: string, signal: AbortSignal): Promise<RacePitData> {
  const data = raceSchema.parse(await request('race', season, round, signal));
  if (data.season !== season) throw Error('Season mismatch');
  return data;
}
