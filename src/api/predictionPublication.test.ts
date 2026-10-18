import { afterEach, describe, expect, it, vi } from 'vitest';
import { publishToSupabase } from '../../scripts/publish-race-winner-prediction';

const mock = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: mock.createClient }));

function database(saved: { driver_id: string }[], current: object | null = null) {
  const candidateWrites = vi.fn();
  const modelWrites = vi.fn();
  mock.createClient.mockReturnValue({ from: (table: string) => {
    let reading = false;
    const query = {
      select: () => { reading = true; return query; },
      eq: () => query,
      update: () => query,
      upsert: (value: unknown) => {
        if (table === 'prediction_candidates') candidateWrites();
        if (table === 'prediction_models') modelWrites(value);
        return query;
      },
      maybeSingle: async () => ({ data: table === 'prediction_runs' ? { id: 'run' } : current, error: null }),
      single: async () => ({ data: { id: 'run' }, error: null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({
        data: table === 'prediction_candidates' && reading ? saved : null, error: null,
      }).then(resolve),
    };
    return query;
  } });
  vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only');
  return { candidateWrites, modelWrites };
}

const publish = (postQuali = true) => publishToSupabase(
  { phase: postQuali ? 'post_quali' : 'pre_weekend', featureNames: [], model: { bias: 0, weights: {} },
    recipe: { featureSet: 'baseline', weighting: 'equal' }, calibration: { method: 'temperature', enabled: false, temperature: 1, sampleCount: 0, raceKeys: [] },
    training: { trainedThrough: { season: 2026, round: 12 }, raceKeys: [], raceCount: 0, bySeason: {} },
    backtest: { metrics: { raceCount: 0, winnerCoverage: 0, top1Accuracy: 0, top3Accuracy: 0, logLoss: 0, brierScore: 0 },
      rawMetrics: { raceCount: 0, winnerCoverage: 0, top1Accuracy: 0, top3Accuracy: 0, logLoss: 0, brierScore: 0 }, bySeason: {}, races: [] } },
  'test-model',
  { season: 2026, round: 13, raceName: 'Italian GP', qualifying: postQuali ? [{}, {}] : [] } as Parameters<typeof publishToSupabase>[2],
  '2026-09-06T09:00:00Z', 'hash',
  [{ driverId: 'a', constructorId: 'x', rank: 1, probability: 1, score: 1, factors: [], winner: true }],
);

afterEach(() => vi.unstubAllEnvs());
describe('prediction publication recovery', () => {
  it('repairs a run whose candidates were never saved', async () => {
    const { candidateWrites: writes, modelWrites } = database([]);
    expect((await publish()).published).toBe(true);
    expect(writes).toHaveBeenCalledOnce();
    expect(modelWrites).toHaveBeenCalledWith(expect.objectContaining({
      feature_schema_version: 3, trained_through_season: 2026, trained_through_round: 12,
      artifact: expect.objectContaining({ phase: 'post_quali' }),
    }));
  });
  it('leaves an identical complete publication unchanged', async () => {
    const { candidateWrites: writes } = database([{ driver_id: 'a' }]);
    expect((await publish()).published).toBe(false);
    expect(writes).not.toHaveBeenCalled();
  });
  it('does not downgrade an existing post-qualifying prediction when the source loses qualifying', async () => {
    const { candidateWrites: writes } = database([], { run_id: 'final', phase: 'post_quali', candidates: Array(22).fill({}) });
    expect(await publish(false)).toEqual({ published: false, runId: 'final' });
    expect(writes).not.toHaveBeenCalled();
  });
});
