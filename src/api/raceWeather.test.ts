import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getRaceWeather } from './raceWeather';
const session = vi.hoisted(() => vi.fn());
vi.mock('./memberAccess', () => ({ requireMemberSession: session, MemberAccessError: class extends Error {} }));
const stat = { min: 25, max: 27, average: 26 };
const payload = { season: '2026', round: '18', source: 'openf1', sessionKey: 11396, updatedAt: '2026-10-26T00:00:00Z',
  summary: { airTempC: stat, trackTempC: stat, humidityPct: stat, rainPointCount: 0, rainLapRanges: [], maxWindSpeedMps: 3 } };
beforeEach(() => session.mockResolvedValue({ access_token: 'test-member', user: { id: 'member-1' } }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks(); });
describe('race weather contract', () => {
  it('uses the same-origin member endpoint and validates the requested race', async () => {
    const fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify(payload)));
    vi.stubGlobal('fetch', fetch);
    const result = await getRaceWeather('2026', '18', new AbortController().signal);
    expect(result.summary?.airTempC.average).toBe(26);
    expect(fetch.mock.calls[0][0]).toBe('/api/race-weather?season=2026&round=18');
    expect(fetch.mock.calls[0][1]).toMatchObject({ headers: { Authorization: 'Bearer test-member' }, cache: 'no-store' });
    await expect(getRaceWeather('2026', '17', new AbortController().signal)).rejects.toThrow('分站不匹配');
  });
  it('does not release a response after the member identity changes', async () => {
    session.mockResolvedValueOnce({ access_token: 'test-member', user: { id: 'member-1' } })
      .mockResolvedValueOnce({ access_token: 'different-member', user: { id: 'member-2' } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(payload))));
    await expect(getRaceWeather('2026', '18', new AbortController().signal)).rejects.toThrow();
  });
  it.each([401, 403, 502])('keeps HTTP %s failures retryable', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status })));
    await expect(getRaceWeather('2026', '18', new AbortController().signal)).rejects.toThrow();
  });
  it('rejects malformed observation summaries', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...payload, summary: { ...payload.summary, maxWindSpeedMps: -1 } }))));
    await expect(getRaceWeather('2026', '18', new AbortController().signal)).rejects.toThrow();
  });
});
