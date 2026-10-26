import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Circuit } from '@/types';
import { useCircuitDetailData } from './useCircuitDetailData';

const api = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('@/api/supabase', () => ({ supabaseApi: { circuits: { getById: api.load } } }));
vi.mock('./useSeasonDataCached', () => ({ useSeasonRacesCached: () => ({ races: [], loading: false }) }));

describe('circuit detail fallbacks', () => {
  let renderer: ReactTestRenderer;
  let latest: ReturnType<typeof useCircuitDetailData>;
  function Probe({ id }: { id: string }) {
    const circuit: Circuit = { circuitId: id, circuitName: id, url: '#', Location: { locality: '', country: '', lat: '', long: '' } };
    latest = useCircuitDetailData(id, '2026', { circuit });
    return null;
  }
  afterEach(() => { act(() => renderer?.unmount()); vi.resetAllMocks(); });

  it('fills every core field for a database ID with no remote row', async () => {
    api.load.mockResolvedValue(null);
    await act(async () => { renderer = create(<Probe id="spielberg" />); });
    await vi.waitFor(() => expect(latest.detailsLoading).toBe(false));
    expect(latest.circuitDetails).toMatchObject({ length: '4.326', turns: 10, direction: 'CLOCKWISE', first_race: 1970 });
    expect(Number(latest.circuitDetails?.total_races)).toBeGreaterThan(0);
    expect(latest.circuitDetails?.total_distance).toBeTruthy();
  });

  it('does not let remote placeholders replace known local data', async () => {
    api.load.mockResolvedValue({ length: '--', turns: '资料待补', direction: 'unknown', total_distance: 'N/A', first_race: '-', total_races: null });
    await act(async () => { renderer = create(<Probe id="villeneuve" />); });
    await vi.waitFor(() => expect(latest.circuitDetails?.length).toBe('4.361'));
    expect(latest.circuitDetails).toMatchObject({ turns: 14, direction: 'CLOCKWISE', first_race: 1978 });
  });

  it('retains the local profile when the database is offline', async () => {
    api.load.mockRejectedValue(new Error('offline'));
    await act(async () => { renderer = create(<Probe id="madring" />); });
    await vi.waitFor(() => expect(latest.detailsLoading).toBe(false));
    expect(latest.circuitDetails).toMatchObject({ length: '5.414', turns: 22, first_race: 2026, total_distance: '308.399 km' });
  });

  it('uses the published lap length when only race distance is returned remotely', async () => {
    api.load.mockResolvedValue({ length: null, total_distance: '305.888 km', race_laps: 50 });
    await act(async () => { renderer = create(<Probe id="vegas" />); });
    expect(latest.circuitDetails?.length).toBe('6.201');
  });
});
