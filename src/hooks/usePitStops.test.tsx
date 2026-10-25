import { act, create } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import { getAwardData } from '@/api/pitStops';
import { usePitAward } from './usePitStops';
import type { AwardData } from '@/types/pitStops';
vi.mock('@/api/pitStops', () => ({ getAwardData: vi.fn(), getRacePitData: vi.fn() }));
let state!: ReturnType<typeof usePitAward>;
let view: ReturnType<typeof create> | undefined;
function Probe({ season }: { season: string }) { state = usePitAward(season); return null; }
afterEach(() => { act(() => view?.unmount()); vi.resetAllMocks(); });
it('cancels the old season request and never applies its late response', async () => {
  const pending: Array<{ signal: AbortSignal; resolve: (value: AwardData) => void }> = [];
  vi.mocked(getAwardData).mockImplementation((_s,_r,signal) => new Promise(resolve => pending.push({ signal, resolve })));
  act(() => { view = create(<Probe season="2024" />); });
  act(() => view!.update(<Probe season="2025" />));
  expect(pending[0].signal.aborted).toBe(true);
  const data: AwardData = { season: '2025', seasons: [2025], standings: [{team:'A',rank:1,points:1}], stops: [], seasonFastest: [{ id:'fastest', rank:1, driver:'Oscar Piastri', team:'McLaren', event:'Monza', eventAbbreviation:'ITA', duration:'1.91' }], source:'https://inmotion.dhl', updatedAt: '2026-10-25T00:00:00Z', stale: false };
  await act(async () => pending[1].resolve(data));
  await act(async () => pending[0].resolve({ ...data, season:'2024' }));
  expect(state.data?.season).toBe('2025');
  vi.mocked(getAwardData).mockRejectedValueOnce(Error('offline'));
  await act(async () => state.retry());
  expect(state.data?.standings).toHaveLength(1);
  expect(state.data?.seasonFastest[0].duration).toBe('1.91');
  expect(state.data?.stale).toBe(true);
});
