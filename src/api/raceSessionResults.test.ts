import { beforeEach, expect, it, vi } from 'vitest';
import { raceSessionResultsApi } from './raceSessionResults';

const db = vi.hoisted(() => {
  const query = { select: vi.fn(), eq: vi.fn(), abortSignal: vi.fn() };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
});
vi.mock('@/utils/supabase', () => ({ supabase: { from: () => db } }));

const result = {
  position: '1', positionText: '1', points: '0', grid: '-', laps: '20', status: '',
  Driver: { driverId: 'norris', givenName: 'Lando', familyName: 'Norris' },
  Constructor: { constructorId: 'mclaren', name: 'McLaren' },
};
beforeEach(() => vi.clearAllMocks());

it.each(['FP1', 'SQ'] as const)('reads imported %s results without unrelated circuit metadata', async (session) => {
  const payload = { season: '2025', round: '2', raceName: 'Chinese Grand Prix', date: '', Circuit: {},
    ...(session === 'SQ' ? { QualifyingResults: [result] } : { Results: [result] }) };
  db.abortSignal.mockResolvedValue({ data: [{ session, source: 'fastf1', payload }], error: null });
  const response = await raceSessionResultsApi.getSessionResult('2025', '2', session);
  expect(session === 'SQ' ? response?.QualifyingResults : response?.Results).toHaveLength(1);
});

it('rejects mismatched race identities and malformed result rows', async () => {
  db.abortSignal.mockResolvedValue({ data: [
    { session: 'FP1', payload: { season: '2025', round: '3', Results: [result] } },
    { session: 'FP1', payload: { season: '2025', round: '2', Results: [{}] } },
  ], error: null });
  expect(await raceSessionResultsApi.getPracticeResult('2025', '2', 1)).toBeNull();
});

it('does not accept an empty or wrong-session classification as a successful load', async () => {
  db.abortSignal.mockResolvedValue({ data: [
    { session: 'FP1', source: 'fastf1', payload: { season: '2025', round: '2', QualifyingResults: [result] } },
    { session: 'FP1', source: 'fastf1', payload: { season: '2025', round: '2', Results: [] } },
  ], error: null });
  expect(await raceSessionResultsApi.getPracticeResult('2025', '2', 1)).toBeNull();
});

it('does not let a driver roster with no classification block the timing fallback', async () => {
  db.abortSignal.mockResolvedValue({ data: [{ session: 'FP1', source: 'fastf1', payload: {
    season: '2025', round: '2', Results: [{ ...result, position: '', positionText: '-' }],
  } }], error: null });
  expect(await raceSessionResultsApi.getPracticeResult('2025', '2', 1)).toBeNull();
});
