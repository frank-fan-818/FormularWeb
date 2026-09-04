import { afterEach, describe, expect, it, vi } from 'vitest';
import { mapRacePredictionRow, predictionsApi } from './predictions';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('prediction API mapping', () => {
  it('maps the public Supabase view into the frontend contract', () => {
    expect(mapRacePredictionRow({
      run_id: '8cf2f4cd-9743-4bb2-a169-a62f11512828',
      season: 2026,
      round: 8,
      race_name: 'Monaco Grand Prix',
      phase: 'post_quali',
      model_version: 'winner-linear-2026.09',
      generated_at: '2026-09-03T10:00:00.000Z',
      data_cutoff_at: '2026-09-03T09:58:00.000Z',
      candidates: [{
        driver_id: 'charles_leclerc', constructor_id: 'ferrari', rank: 1,
        probability: '0.42', factors: [{ feature: 'qualifyingPole', contribution: 0.3 }],
      }],
    })).toMatchObject({
      season: 2026,
      round: 8,
      phase: 'post_quali',
      candidates: [{ driverId: 'charles_leclerc', probability: 0.42 }],
    });
  });

  it('rejects probabilities outside the model contract', () => {
    expect(() => mapRacePredictionRow({
      run_id: '8cf2f4cd-9743-4bb2-a169-a62f11512828', season: 2026, round: 8,
      race_name: 'Race', phase: 'post_quali', model_version: 'v1',
      generated_at: '2026-09-03T10:00:00.000Z', data_cutoff_at: '2026-09-03T09:58:00.000Z',
      candidates: [{ driver_id: 'driver', constructor_id: 'team', rank: 1, probability: 1.2, factors: [] }],
    })).toThrow();
  });

  it('remains interceptable when browser configuration is absent', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    const fetchMock = vi.fn().mockResolvedValue(new Response('[]', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(predictionsApi.getRacePrediction(2026, 13)).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({ href: expect.stringContaining('https://example.supabase.co/rest/v1/') }),
      expect.any(Object),
    );
  });
});
