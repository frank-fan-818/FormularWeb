import { afterEach, expect, it, vi } from 'vitest';
import { seasonApi } from './raceClassifications';
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it('rejects incomplete classifications instead of silently displaying partial results', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ MRData: {
    total: '22', RaceTable: { Races: [{ Results: [{ Driver: { driverId: 'a' } }] }] },
  } }))));
  await expect(seasonApi.getRaceResults('2026', '1')).rejects.toThrow();
});
it('cancels the network request when the race is left', async () => {
  const controller = new AbortController();
  const fetcher = vi.fn<typeof fetch>().mockImplementation((_url, options) => new Promise((_resolve, reject) => {
    options!.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
  }));
  vi.stubGlobal('fetch', fetcher);
  const pending = seasonApi.getRaceResults('2026', '1', controller.signal);
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('does not retry permanent HTTP errors', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 404 }));
  vi.stubGlobal('fetch', fetcher);
  await expect(seasonApi.getQualifyingResults('2026', '1')).rejects.toThrow('404');
  expect(fetcher).toHaveBeenCalledTimes(1);
});
