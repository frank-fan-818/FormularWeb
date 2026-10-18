import { describe, expect, it, vi } from 'vitest';
import { fetchPreRacePredictionObservation } from './preRacePredictionInputs';

function provider(missingDriver = false, fail = false) {
  return vi.fn(async (input: string | URL) => {
    const url = new URL(input);
    if (fail) return new Response('', { status: 403 });
    if (url.pathname.endsWith('/sessions')) return Response.json([{ session_key: 99, session_name: 'Race', session_type: 'Race', date_start: '2026-09-12T12:00:00Z' }]);
    if (url.hostname === 'api.jolpi.ca') {
      if (url.pathname.endsWith('/drivers.json')) return Response.json({ MRData: { total: '16', DriverTable: { Drivers: Array.from({ length: 16 }, (_, index) => ({ driverId: `d${index}`, code: `D${index}`, permanentNumber: String(index + 1) })) } } });
      return Response.json({ MRData: { total: '1', ConstructorTable: { Constructors: [{ constructorId: 'team', name: 'Team' }] } } });
    }
    if (url.pathname.endsWith('/starting_grid')) return Response.json(Array.from({ length: 16 }, (_, index) => ({ driver_number: index + 1, position: index === 0 ? 0 : index })));
    return Response.json(Array.from({ length: 16 }, (_, index) => ({ driver_number: index + 1, name_acronym: missingDriver && index === 0 ? 'UNKNOWN' : `D${index}`, team_name: 'Team' })));
  });
}
const target = { season: 2026, raceStartAt: '2026-09-12T12:00:00Z', expectedFieldSize: 16 };
const clock = () => Date.parse('2026-09-11T12:00:00Z');
describe('optional confirmed pre-race provider', () => {
  it('joins exact session identities to Jolpica IDs and preserves pit-lane grid zero', async () => {
    const result = await fetchPreRacePredictionObservation(target, { fetcher: provider(), clock });
    expect(result.reason).toBe('confirmed');
    expect(result.observation?.entries).toHaveLength(16);
    expect(result.observation?.entries[0]).toEqual({ driverId: 'd0', constructorId: 'team', gridPosition: 0 });
    expect(result.observation?.observedAt).toBe('2026-09-11T12:00:00.000Z');
  });
  it('never confirms a partial/ambiguous field and tolerates provider authentication failures', async () => {
    const fetcher = provider();
    fetcher.mockImplementationOnce(async () => new Response('', { status: 403 }));
    expect((await fetchPreRacePredictionObservation(target, { fetcher, clock })).observation).toBeUndefined();
    const unknown = provider(true);
    // An acronym that cannot be mapped can fall back to a unique permanent number.
    expect((await fetchPreRacePredictionObservation(target, { fetcher: unknown, clock })).reason).toBe('confirmed');
    const closed = provider();
    expect((await fetchPreRacePredictionObservation(target, { fetcher: closed, clock: () => Date.parse(target.raceStartAt) })).reason).toBe('race-started');
    expect(closed).not.toHaveBeenCalled();
  });
  it('rejects a session for a different race date', async () => {
    const fetcher = provider();
    fetcher.mockImplementationOnce(async () => Response.json([{ session_key: 88, session_name: 'Race', session_type: 'Race', date_start: '2026-09-05T12:00:00Z' }]));
    expect((await fetchPreRacePredictionObservation(target, { fetcher, clock })).reason).toBe('no-session');
  });

  it('refuses a provider response smaller than the known entry field', async () => {
    const source = provider();
    const fetcher = vi.fn(async (url: string | URL) => {
      const response = await source(url);
      if (new URL(url).hostname === 'api.openf1.org' && new URL(url).pathname.endsWith('/drivers')) return Response.json((await response.json()).slice(0, 15));
      return response;
    });
    expect((await fetchPreRacePredictionObservation(target, { fetcher, clock })).reason).toBe('incomplete-field');
  });

  it('uses the existing constructor aliases across provider names', async () => {
    const source = provider();
    const fetcher = async (url: string) => {
      const response = await source(url);
      if (new URL(url).pathname.endsWith('/constructors.json')) return Response.json({ MRData: { total: '1', ConstructorTable: { Constructors: [{ constructorId: 'rb', name: 'RB F1 Team' }] } } });
      if (new URL(url).hostname === 'api.openf1.org' && new URL(url).pathname.endsWith('/drivers')) return Response.json((await response.json()).map((row: object) => ({ ...row, team_name: 'Racing Bulls' })));
      return response;
    };
    const result = await fetchPreRacePredictionObservation(target, { fetcher, clock });
    expect(result.reason).toBe('confirmed');
    expect(result.observation?.entries.every((row) => row.constructorId === 'rb')).toBe(true);
  });
});
