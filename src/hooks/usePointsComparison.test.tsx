import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePointsComparison } from './usePointsComparison';
import type { SeasonPointsProgress } from '@/types/pointsComparison';

const api = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('@/api/standingsProgress', () => ({ standingsProgressApi: { getSeasonProgress: api.load } }));
const entries = ['a', 'b', 'c'].map(id => ({ id, name: id, color: '#00aaaa' }));
const progress: SeasonPointsProgress = { latest: { round: 1, points: { a: 25, b: 18, c: 0 } }, rounds: [] };

describe('points comparison lifecycle', () => {
  let renderer: ReactTestRenderer;
  let latest: ReturnType<typeof usePointsComparison>;
  function Probe({ season = '2026', ownId = 'a' }: { season?: string; ownId?: string }) {
    latest = usePointsComparison('driver', season, ownId, entries);
    return null;
  }
  afterEach(() => { act(() => renderer?.unmount()); vi.resetAllMocks(); });

  it('loads only after selection and switches opponents without refetching all rounds', async () => {
    api.load.mockResolvedValue(progress);
    act(() => { renderer = create(<Probe />); });
    expect(api.load).not.toHaveBeenCalled();
    act(() => latest.toggle());
    expect(api.load).not.toHaveBeenCalled();
    await act(async () => { latest.select('b'); });
    await vi.waitFor(() => expect(latest.data).toEqual(progress));
    expect(api.load).toHaveBeenCalledTimes(1);
    act(() => latest.select('c'));
    expect(latest.opponent?.id).toBe('c');
    expect(latest.data).toEqual(progress);
    expect(api.load).toHaveBeenCalledTimes(1);
    act(() => latest.select(null));
    expect(latest.data).toBeNull();
    act(() => latest.toggle());
    expect(latest.enabled).toBe(false);
  });

  it('discards a late previous-season response and resets selection on profile changes', async () => {
    let release!: (data: SeasonPointsProgress) => void;
    api.load.mockReturnValue(new Promise<SeasonPointsProgress>(resolve => { release = resolve; }));
    act(() => { renderer = create(<Probe />); });
    await act(async () => { latest.toggle(); latest.select('b'); });
    await vi.waitFor(() => expect(api.load).toHaveBeenCalledTimes(1));
    act(() => renderer.update(<Probe season="2025" ownId="c" />));
    expect(latest.enabled).toBe(false);
    await act(async () => { release(progress); });
    expect(latest.data).toBeNull();
    expect(latest.opponent).toBeUndefined();
    act(() => renderer.update(<Probe />));
    expect(latest.enabled).toBe(false);
  });

  it('provides a recoverable error instead of zero-valued comparisons', async () => {
    api.load.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValue(progress);
    act(() => { renderer = create(<Probe />); });
    await act(async () => { latest.toggle(); latest.select('b'); });
    await vi.waitFor(() => expect(latest.error).toBe(true));
    expect(latest.data).toBeNull();
    await act(async () => { latest.retry(); });
    await vi.waitFor(() => expect(latest.data).toEqual(progress));
    expect(latest.error).toBe(false);
  });

  it('reports request progress immediately and ignores progress after closing comparison', async () => {
    let report!: (progress: { completed: number; total: number }) => void;
    let release!: (data: SeasonPointsProgress) => void;
    api.load.mockImplementation((_kind, _season, onProgress) => {
      report = onProgress;
      return new Promise<SeasonPointsProgress>(resolve => { release = resolve; });
    });
    act(() => { renderer = create(<Probe />); });
    await act(async () => { latest.toggle(); latest.select('b'); });
    expect(latest.loading).toBe(true);
    await vi.waitFor(() => expect(report).toBeTypeOf('function'));
    act(() => report({ completed: 4, total: 17 }));
    expect(latest.progress).toEqual({ completed: 4, total: 17 });
    act(() => latest.toggle());
    await act(async () => { report({ completed: 17, total: 17 }); release(progress); });
    expect(latest.loading).toBe(false);
    expect(latest.progress).toBeUndefined();
    expect(latest.data).toBeNull();
  });
});
