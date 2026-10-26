import { z } from 'zod';
import { requireMemberSession, MemberAccessError } from './memberAccess';
import type { RaceWeatherResponse } from '@/types/raceWeather';

const stat = z.object({ min: z.number().finite().nullable(), max: z.number().finite().nullable(), average: z.number().finite().nullable() });
const schema = z.object({
  season: z.string(), round: z.string(), source: z.literal('openf1'), sessionKey: z.number().int().positive().nullable(), updatedAt: z.iso.datetime(),
  summary: z.object({ airTempC: stat, trackTempC: stat, humidityPct: stat, rainPointCount: z.number().int().nonnegative(),
    rainLapRanges: z.array(z.object({ startLap: z.number().int().positive(), endLap: z.number().int().positive() })), maxWindSpeedMps: z.number().nonnegative().nullable() }).nullable(),
});

export async function getRaceWeather(season: string, round: string, signal: AbortSignal): Promise<RaceWeatherResponse> {
  const member = await requireMemberSession();
  const response = await fetch(`/api/race-weather?${new URLSearchParams({ season, round })}`, {
    headers: { Authorization: `Bearer ${member.access_token}` }, cache: 'no-store', redirect: 'error',
    signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
  });
  if (response.status === 401 || response.status === 403) throw new MemberAccessError();
  if (!response.ok) throw new Error('天气数据读取失败，请重试。');
  const data = schema.parse(await response.json());
  const current = await requireMemberSession();
  if (member.user.id !== current.user.id) throw new MemberAccessError();
  if (data.season !== season || data.round !== round) throw new Error('天气数据与当前分站不匹配。');
  return data;
}
