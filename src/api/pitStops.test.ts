import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAwardData, getRacePitData } from './pitStops';

afterEach(() => vi.unstubAllGlobals());
const envelope = { season: '2025', updatedAt: '2026-10-25T07:00:00.000Z', stale: false };
describe('pit stop API contract', () => {
  it('validates season fastest records and accepts older cached envelopes without them', async () => {
    const fastest = { id: '1', rank: 1, driver: 'Oscar Piastri', team: 'McLaren', event: 'Monza', eventAbbreviation: 'ITA', duration: '1.91' };
    const payload: Record<string, unknown> = { ...envelope, seasons: [2025], source: 'https://inmotion.dhl', standings: [], stops: [], seasonFastest: [fastest] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));
    expect((await getAwardData('2025', '', new AbortController().signal)).seasonFastest[0]).toEqual(fastest);
    payload.seasonFastest = [{ ...fastest, duration: '0' }];
    await expect(getAwardData('2025', '', new AbortController().signal)).rejects.toThrow();
    delete payload.seasonFastest;
    expect((await getAwardData('2025', '', new AbortController().signal)).seasonFastest).toEqual([]);
  });
  it('rejects mismatched seasons and malformed official points', async () => {
    const payload = { ...envelope, seasons: [2025], source: 'https://inmotion.dhl', standings: [{ rank: 1, team: 'Ferrari', points: null }], stops: [] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));
    await expect(getAwardData('2025', '', new AbortController().signal)).rejects.toThrow();
    payload.standings = [];
    await expect(getAwardData('2024', '', new AbortController().signal)).rejects.toThrow('Season mismatch');
  });
  it('does not interpret zero as a static stop', async () => {
    const record = { driverId: 'a', driver: 'A', code: 'AAA', team: 'A', constructorId: 'a', lap: 1, stop: 1, laneDuration: '24.229', stopDuration: '0', laneSource: 'Jolpica', stopSource: null };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...envelope, records: [record] }) }));
    await expect(getRacePitData('2025', '4', new AbortController().signal)).rejects.toThrow();
    record.stopDuration = null as unknown as string;
    expect((await getRacePitData('2025', '4', new AbortController().signal)).records[0].stopDuration).toBeNull();
  });
});
