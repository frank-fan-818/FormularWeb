import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRaceWeatherSummary } from './useRaceWeatherSummary';
import type { FastF1WeatherSummary } from '@/types';
import type { RaceWeatherResponse } from '@/types/raceWeather';
const api = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('@/api/raceWeather', () => ({ getRaceWeather: api.load }));
const stat = { min: 25, max: 27, average: 26 };
const summary: FastF1WeatherSummary = { airTempC: stat, trackTempC: stat, humidityPct: stat, rainPointCount: 0, rainLapRanges: [], maxWindSpeedMps: 3 };
const response = { summary } as RaceWeatherResponse;
const retryPrimary = vi.fn();
describe('race weather source and lifecycle', () => {
  let renderer: ReactTestRenderer;
  let latest: ReturnType<typeof useRaceWeatherSummary>;
  function Probe({ round = '18', primarySummary = null, primaryLoading = false, memberId = 'member-1', enabled = true }: {
    round?: string; primarySummary?: FastF1WeatherSummary | null; primaryLoading?: boolean; memberId?: string; enabled?: boolean;
  }) {
    latest = useRaceWeatherSummary({ season: '2026', round, primarySummary, primaryLoading, memberId, enabled, primaryError: null, retryPrimary });
    return null;
  }
  afterEach(() => { act(() => renderer?.unmount()); vi.resetAllMocks(); });
  it('falls back after an empty FastF1 export, but keeps populated FastF1 weather preferred', async () => {
    api.load.mockResolvedValue(response);
    await act(async () => { renderer = create(<Probe />); });
    expect(latest).toMatchObject({ summary, source: 'openf1', loading: false, error: null });
    await act(async () => { renderer.update(<Probe primarySummary={summary} />); });
    expect(latest.source).toBe('fastf1');
    expect(api.load).toHaveBeenCalledTimes(1);
  });
  it('waits for primary loading and never requests fallback data for guests', async () => {
    await act(async () => { renderer = create(<Probe primaryLoading />); });
    expect(latest.loading).toBe(true);
    expect(api.load).not.toHaveBeenCalled();
    await act(async () => { renderer.update(<Probe enabled={false} />); });
    expect(latest.summary).toBeNull();
    expect(api.load).not.toHaveBeenCalled();
  });
  it('clears obsolete weather on race and member changes and ignores late responses', async () => {
    let release!: (value: RaceWeatherResponse) => void;
    api.load.mockReturnValueOnce(new Promise<RaceWeatherResponse>(resolve => { release = resolve; })).mockResolvedValueOnce({ summary: null });
    await act(async () => { renderer = create(<Probe />); });
    await act(async () => { renderer.update(<Probe round="19" memberId="member-2" />); });
    await act(async () => { release(response); });
    expect(latest.summary).toBeNull();
    expect(latest.error).toBeNull();
  });
  it('retries failed fallback data rather than preserving an empty success forever', async () => {
    api.load.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response);
    await act(async () => { renderer = create(<Probe />); });
    expect(latest.error?.message).toBe('offline');
    await act(async () => { latest.retry(); });
    expect(latest.summary).toEqual(summary);
    expect(latest.error).toBeNull();
  });
});
