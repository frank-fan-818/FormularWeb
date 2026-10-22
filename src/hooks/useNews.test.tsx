import { act, create } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getNews } from '@/api/news';
import type { NewsResult } from '@/types/news';
import { useNews } from './useNews';

vi.mock('@/api/news', () => ({ getNews: vi.fn() }));
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('news request lifecycle', () => {
  it('refreshes visible pages every five minutes, pauses while hidden and cleans up timers', async () => {
    vi.useFakeTimers();
    const events = new EventTarget();
    const visibility = { hidden: false, addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events) };
    vi.stubGlobal('document', visibility);
    vi.mocked(getNews).mockResolvedValue({ items: [], sources: [] });
    function Probe() { useNews(); return null; }
    let view!: ReturnType<typeof create>;
    await act(async () => { view = create(<Probe />); });
    expect(getNews).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(5 * 60_000); });
    expect(getNews).toHaveBeenCalledTimes(2);
    visibility.hidden = true;
    await act(async () => { await vi.advanceTimersByTimeAsync(10 * 60_000); });
    expect(getNews).toHaveBeenCalledTimes(2);
    visibility.hidden = false;
    await act(async () => { events.dispatchEvent(new Event('visibilitychange')); });
    expect(getNews).toHaveBeenCalledTimes(3);
    act(() => view.unmount());
    await act(async () => { await vi.advanceTimersByTimeAsync(10 * 60_000); });
    events.dispatchEvent(new Event('visibilitychange'));
    expect(getNews).toHaveBeenCalledTimes(3);
  });

  it('ignores a superseded response and cancels the active request on unmount', async () => {
    const pending: { signal: AbortSignal; resolve: (value: NewsResult) => void }[] = [];
    vi.mocked(getNews).mockImplementation(options => new Promise(resolve => pending.push({ signal: options!.signal!, resolve })));
    let latest!: ReturnType<typeof useNews>;
    function Probe() { latest = useNews(); return null; }
    let view!: ReturnType<typeof create>;
    act(() => { view = create(<Probe />); });
    expect(latest.loading).toBe(true);
    act(() => latest.refresh());
    expect(pending[0].signal.aborted).toBe(true);
    await act(async () => pending[1].resolve({ items: [], sources: [{ sourceId: 'fia', status: 'ready', updatedAt: '2026-10-21T09:00:00Z' }] }));
    expect(latest.loading).toBe(false);
    await act(async () => pending[0].resolve({ items: [], sources: [] }));
    expect(latest.sources).toHaveLength(1);
    act(() => latest.refresh());
    act(() => view.unmount());
    expect(pending[2].signal.aborted).toBe(true);
  });

  it('exposes an unexpected load failure and can retry without remounting', async () => {
    vi.mocked(getNews).mockRejectedValueOnce(new Error('unexpected')).mockResolvedValueOnce({ items: [], sources: [] });
    let latest!: ReturnType<typeof useNews>;
    function Probe() { latest = useNews(); return null; }
    let view!: ReturnType<typeof create>;
    await act(async () => { view = create(<Probe />); });
    expect(latest.error).toBe(true);
    await act(async () => latest.refresh());
    expect(latest.error).toBe(false);
    expect(latest.loading).toBe(false);
    act(() => view.unmount());
  });
});
