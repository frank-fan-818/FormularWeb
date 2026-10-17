import { act, create } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';
import type { RaceWinnerPrediction } from '@/types/racePrediction';
import { usePredictionDetails } from './usePredictionDetails';

describe('prediction disclosure lifecycle', () => {
  it('opens the chosen driver, closes, and clears selection when data changes or disappears', () => {
    const prediction: RaceWinnerPrediction = { runId: 'run-1', season: 2026, round: 13, raceName: 'Monza',
      phase: 'pre_weekend', modelVersion: 'test', generatedAt: new Date().toISOString(), dataCutoffAt: new Date().toISOString(),
      candidates: [{ driverId: 'kimi_antonelli', constructorId: 'mercedes', rank: 1, probability: 0.4, factors: [] }] };
    let latest: ReturnType<typeof usePredictionDetails>;
    function Probe({ data }: { data: RaceWinnerPrediction | null }) { latest = usePredictionDetails(data); return null; }
    const renderer = create(<Probe data={prediction} />);
    act(() => latest.openDetails('george_russell'));
    expect(latest!.details).toMatchObject({ open: true, driverId: 'george_russell' });
    act(() => latest.closeDetails());
    expect(latest!.details?.open).toBe(false);
    act(() => latest.openDetails());
    expect(latest!.details?.driverId).toBe('kimi_antonelli');
    act(() => renderer.update(<Probe data={null} />));
    expect(latest!.details).toBeNull();
    act(() => renderer.update(<Probe data={prediction} />));
    expect(latest!.details).toBeNull();
    act(() => latest.openDetails());
    act(() => renderer.update(<Probe data={{ ...prediction, runId: 'run-2' }} />));
    expect(latest!.details).toBeNull();
    act(() => renderer.unmount());
  });
});
