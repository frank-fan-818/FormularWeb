import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRacePreviewSummary } from './useRaceWeekendAnalytics';
import type { RacePreviewSummary } from '@/types';

const api = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('@/api/raceWeekendAnalytics', () => ({ raceWeekendAnalyticsApi: { getRacePreviewSummary: api.load } }));
const summary = (season: number, circuitId: string): RacePreviewSummary => ({
  season, round: 1, circuitId, recentResults: [], interruptionProbabilities: [],
  interruptionSamples: [], poleWinConversionPct: null, sampleSize: 0,
});

describe('race preview history lifecycle', () => {
  let renderer: ReactTestRenderer;
  let latest: ReturnType<typeof useRacePreviewSummary>;
  function Probe({ season = '2026', circuitId = 'monza', enabled = true }) {
    latest = useRacePreviewSummary(season, '1', circuitId, enabled);
    return null;
  }
  afterEach(() => { act(() => renderer?.unmount()); vi.resetAllMocks(); });

  it('clears the previous venue immediately and ignores its late response', async () => {
    let release!: (value: RacePreviewSummary) => void;
    api.load.mockReturnValueOnce(new Promise<RacePreviewSummary>(resolve => { release = resolve; }))
      .mockResolvedValueOnce(summary(2026, 'suzuka'));
    await act(async () => { renderer = create(<Probe />); });
    await vi.waitFor(() => expect(api.load).toHaveBeenCalledTimes(1));
    act(() => renderer.update(<Probe circuitId="suzuka" />));
    expect(latest.data).toBeNull();
    expect(latest.loading).toBe(true);
    await vi.waitFor(() => expect(latest.data?.circuitId).toBe('suzuka'));
    await act(async () => { release(summary(2026, 'monza')); });
    expect(latest.data?.circuitId).toBe('suzuka');
  });

  it('does not show the previous season after a failed season switch and can retry', async () => {
    api.load.mockResolvedValueOnce(summary(2026, 'monza'))
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce(summary(2024, 'monza'));
    await act(async () => { renderer = create(<Probe />); });
    await vi.waitFor(() => expect(latest.data?.season).toBe(2026));
    act(() => renderer.update(<Probe season="2024" />));
    expect(latest.data).toBeNull();
    await vi.waitFor(() => expect(latest.error?.message).toBe('unavailable'));
    expect(latest.data).toBeNull();
    await act(async () => { latest.retry(); });
    await vi.waitFor(() => expect(latest.data?.season).toBe(2024));
    expect(latest.error).toBeNull();
    expect(api.load).toHaveBeenLastCalledWith('2024', '1', 'monza');
  });

  it('hides disabled history and ignores an in-flight response after disabling', async () => {
    let release!: (value: RacePreviewSummary) => void;
    api.load.mockReturnValue(new Promise<RacePreviewSummary>(resolve => { release = resolve; }));
    await act(async () => { renderer = create(<Probe />); });
    await vi.waitFor(() => expect(api.load).toHaveBeenCalledTimes(1));
    act(() => renderer.update(<Probe enabled={false} />));
    await act(async () => { release(summary(2026, 'monza')); });
    expect(latest.data).toBeNull();
    expect(latest.loading).toBe(false);
    expect(latest.error).toBeNull();
  });
});
