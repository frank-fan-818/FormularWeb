import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCachedNews, getNews } from '@/api/news';
import type { NewsResult } from '@/types/news';
import { useNews } from './useNews';

vi.mock('@/api/news', () => ({ getCachedNews: vi.fn(), getNews: vi.fn() }));

const cached: NewsResult = { items: [{ id: 'old', sourceId: 'motorsport', kind: 'news', title: 'Cached story',
  url: 'https://www.motorsport.com/f1/news/old/', publishedAt: '2026-10-21T08:00:00Z' }],
  sources: [{ sourceId: 'motorsport', status: 'stale', updatedAt: '2026-10-21T09:00:00Z' }] };
let current!: ReturnType<typeof useNews>;
let view: ReturnType<typeof create> | undefined;
function Probe() { current = useNews(); return null; }
beforeEach(() => vi.mocked(getCachedNews).mockReturnValue({ items: [], sources: [] }));
afterEach(() => { act(() => view?.unmount()); view = undefined; vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetAllMocks(); });

describe('progressive news hook', () => {
  it('shows cached news before a background request finishes and applies progress immediately', async () => {
    vi.mocked(getCachedNews).mockReturnValue(cached);
    let finish!: (result: NewsResult) => void;
    vi.mocked(getNews).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    act(() => { view = create(<Probe />); });
    expect(current.items).toEqual(cached.items);
    expect(current.loading).toBe(true);
    const progress = { ...cached, items: [{ ...cached.items[0], title: 'Fresh story' }] };
    act(() => vi.mocked(getNews).mock.calls[0][0]!.onUpdate!(progress));
    expect(current.items[0].title).toBe('Fresh story');
    expect(current.loading).toBe(true);
    await act(async () => finish(progress));
    expect(current.loading).toBe(false);
  });

  it('ignores progress and completion from a refresh that was replaced', async () => {
    vi.mocked(getCachedNews).mockReturnValue(cached);
    const completions: Array<(value: NewsResult) => void> = [];
    vi.mocked(getNews).mockImplementation(() => new Promise(resolve => completions.push(resolve)));
    act(() => { view = create(<Probe />); });
    const previous = vi.mocked(getNews).mock.calls[0][0]!;
    act(() => current.refresh());
    expect(previous.signal?.aborted).toBe(true);
    act(() => previous.onUpdate!({ items: [], sources: [] }));
    await act(async () => completions[0]({ items: [], sources: [] }));
    expect(current.items).toEqual(cached.items);
    expect(current.loading).toBe(true);
    await act(async () => completions[1](cached));
    expect(current.loading).toBe(false);
  });
});

describe('news request lifecycle', () => {
  it('refreshes visible pages every five minutes, pauses while hidden and cleans up timers', async () => {
    vi.useFakeTimers();
    const events = new EventTarget();
    const visibility = { hidden: false, addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events) };
    vi.stubGlobal('document', visibility);
    vi.mocked(getNews).mockResolvedValue({ items: [], sources: [] });
    act(() => { view = create(<Probe />); });
    await act(async () => undefined);
    expect(getNews).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(5 * 60_000); });
    expect(getNews).toHaveBeenCalledTimes(2);
    visibility.hidden = true;
    await act(async () => { await vi.advanceTimersByTimeAsync(10 * 60_000); });
    expect(getNews).toHaveBeenCalledTimes(2);
    visibility.hidden = false;
    await act(async () => { events.dispatchEvent(new Event('visibilitychange')); });
    expect(getNews).toHaveBeenCalledTimes(3);
    act(() => view!.unmount());
    await act(async () => { await vi.advanceTimersByTimeAsync(10 * 60_000); });
    events.dispatchEvent(new Event('visibilitychange'));
    expect(getNews).toHaveBeenCalledTimes(3);
  });

  it('ignores a superseded response and cancels the active request on unmount', async () => {
    const pending: { signal: AbortSignal; resolve: (value: NewsResult) => void }[] = [];
    vi.mocked(getNews).mockImplementation(options => new Promise(resolve => pending.push({ signal: options!.signal!, resolve })));
    act(() => { view = create(<Probe />); });
    expect(current.loading).toBe(true);
    act(() => current.refresh());
    expect(pending[0].signal.aborted).toBe(true);
    await act(async () => pending[1].resolve({ items: [], sources: [{ sourceId: 'fia', status: 'ready', updatedAt: '2026-10-21T09:00:00Z' }] }));
    expect(current.loading).toBe(false);
    await act(async () => pending[0].resolve({ items: [], sources: [] }));
    expect(current.sources).toHaveLength(1);
    act(() => current.refresh());
    act(() => view!.unmount());
    expect(pending[2].signal.aborted).toBe(true);
  });

  it('exposes an unexpected load failure and can retry without remounting', async () => {
    vi.mocked(getNews).mockRejectedValueOnce(new Error('unexpected')).mockResolvedValueOnce({ items: [], sources: [] });
    await act(async () => { view = create(<Probe />); });
    expect(current.error).toBe(true);
    await act(async () => current.refresh());
    expect(current.error).toBe(false);
    expect(current.loading).toBe(false);
  });
});
