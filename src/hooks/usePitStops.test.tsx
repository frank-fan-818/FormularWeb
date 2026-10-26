import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePitAward } from './usePitStops';
import type { AwardData } from '@/types/pitStops';

const api = vi.hoisted(() => ({ award: vi.fn(), race: vi.fn() }));
vi.mock('@/api/pitStops', () => ({ getAwardData: api.award, getRacePitData: api.race }));
const award = (points: number): AwardData => ({ season: '2026', seasons: [2026], source: 'https://inmotion.dhl',
  updatedAt: new Date().toISOString(), stale: false, standings: [{ rank: 1, team: 'McLaren', points }], stops: [], seasonFastest: [] });

describe('DHL automatic refresh', () => {
  let renderer: ReactTestRenderer;
  let latest: ReturnType<typeof usePitAward>;
  let browser: EventTarget;
  let page: EventTarget & { visibilityState: string };
  let network: { onLine: boolean };
  function Probe({ season = '2026', round = '81', enabled = true }) { latest = usePitAward(season, round, enabled); return null; }
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime('2026-10-26T06:00:00Z');
    browser = new EventTarget(); page = Object.assign(new EventTarget(), { visibilityState: 'visible' }); network = { onLine: true };
    vi.stubGlobal('window', browser); vi.stubGlobal('document', page); vi.stubGlobal('navigator', network);
  });
  afterEach(() => { act(() => renderer?.unmount()); vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetAllMocks(); });

  it('fetches newly published standings every five minutes while the page stays open', async () => {
    api.award.mockResolvedValueOnce(award(100)).mockResolvedValue(award(125));
    await act(async () => { renderer = create(<Probe />); });
    expect(latest.data?.standings[0].points).toBe(100);
    await act(async () => { await vi.advanceTimersByTimeAsync(300_000); });
    expect(api.award).toHaveBeenCalledTimes(2);
    expect(latest.data?.standings[0].points).toBe(125);
  });

  it('keeps the timer on a warm-cache remount instead of returning before subscribing', async () => {
    api.award.mockResolvedValue(award(100));
    await act(async () => { renderer = create(<Probe round="82" />); });
    act(() => renderer.unmount());
    await act(async () => { renderer = create(<Probe round="82" />); });
    expect(api.award).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(300_000); });
    expect(api.award).toHaveBeenCalledTimes(2);
  });

  it('pauses background polling and refreshes on visibility, focus and reconnection', async () => {
    api.award.mockResolvedValue(award(100));
    await act(async () => { renderer = create(<Probe round="83" />); });
    page.visibilityState = 'hidden';
    await act(async () => { await vi.advanceTimersByTimeAsync(600_000); });
    expect(api.award).toHaveBeenCalledTimes(1);
    page.visibilityState = 'visible';
    await act(async () => { page.dispatchEvent(new Event('visibilitychange')); browser.dispatchEvent(new Event('focus')); });
    expect(api.award).toHaveBeenCalledTimes(2);
    network.onLine = false;
    await act(async () => { await vi.advanceTimersByTimeAsync(300_000); });
    expect(api.award).toHaveBeenCalledTimes(2);
    network.onLine = true;
    await act(async () => { browser.dispatchEvent(new Event('online')); });
    expect(api.award).toHaveBeenCalledTimes(3);
  });

  it('preserves old data during an upstream outage and recovers without a manual retry', async () => {
    api.award.mockResolvedValueOnce(award(100)).mockRejectedValueOnce(new Error('source unavailable')).mockResolvedValue(award(125));
    await act(async () => { renderer = create(<Probe round="84" />); });
    await act(async () => { await vi.advanceTimersByTimeAsync(300_000); });
    expect(latest.data).toMatchObject({ stale: true, standings: [{ points: 100 }] });
    expect(latest.error).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(300_000); });
    expect(latest.data?.standings[0].points).toBe(125);
    expect(latest.error).toBe(false);
  });

  it('cleans up obsolete timers and never replaces the current round with a late response', async () => {
    let release!: (data: AwardData) => void;
    api.award.mockReturnValueOnce(new Promise<AwardData>(resolve => { release = resolve; })).mockResolvedValue(award(125));
    await act(async () => { renderer = create(<Probe round="85" />); });
    await act(async () => { renderer.update(<Probe round="86" />); });
    await act(async () => { release(award(100)); });
    expect(latest.data?.standings[0].points).toBe(125);
    await act(async () => { renderer.update(<Probe round="86" enabled={false} />); });
    await act(async () => { await vi.advanceTimersByTimeAsync(600_000); browser.dispatchEvent(new Event('focus')); });
    expect(api.award).toHaveBeenCalledTimes(2);
    expect(latest.data).toBeNull();
  });

  it('cancels the old season request and never applies its late response', async () => {
    const pending: Array<{ signal: AbortSignal; resolve: (value: AwardData) => void }> = [];
    api.award.mockImplementation((_season, _round, signal) => new Promise(resolve => pending.push({ signal, resolve })));
    await act(async () => { renderer = create(<Probe season="2024" round="87" />); });
    await act(async () => { renderer.update(<Probe season="2025" round="87" />); });
    expect(pending[0].signal.aborted).toBe(true);
    const data: AwardData = { ...award(1), season: '2025', seasonFastest: [{ id: 'fastest', rank: 1, driver: 'Oscar Piastri', team: 'McLaren',
      event: 'Monza', eventAbbreviation: 'ITA', duration: '1.91' }] };
    await act(async () => pending[1].resolve(data));
    await act(async () => pending[0].resolve({ ...data, season: '2024' }));
    expect(latest.data?.season).toBe('2025');
    api.award.mockRejectedValueOnce(Error('offline'));
    await act(async () => latest.retry());
    expect(latest.data?.standings).toHaveLength(1);
    expect(latest.data?.seasonFastest[0].duration).toBe('1.91');
    expect(latest.data?.stale).toBe(true);
  });
});
