import { act, create } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { seasonApi } from '@/api/raceClassifications';
import type { Race } from '@/types';
import { useRacePrimaryResults } from './useRacePrimaryResults';

vi.mock('@/api/raceClassifications', () => ({ seasonApi: { getQualifyingResults: vi.fn(), getRaceResults: vi.fn() } }));
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const race = { Results: [{ Driver: { driverId: 'winner' } }] } as Race;
const qualifying = { QualifyingResults: [{ Driver: { driverId: 'pole' } }] } as Race;
let current!: ReturnType<typeof useRacePrimaryResults>;
let view: ReturnType<typeof create> | undefined;
function Probe({ round = '1' }: { round?: string }) { current = useRacePrimaryResults('2026', round); return null; }
afterEach(() => { act(() => view?.unmount()); view = undefined; vi.resetAllMocks(); });

describe('independent primary classifications', () => {
  it.each(['race', 'qualifying'] as const)('publishes %s before the other request settles', async first => {
    const raceRequest = deferred<Race | null>();
    const qualifyingRequest = deferred<Race | null>();
    vi.mocked(seasonApi.getRaceResults).mockReturnValue(raceRequest.promise);
    vi.mocked(seasonApi.getQualifyingResults).mockReturnValue(qualifyingRequest.promise);
    act(() => { view = create(<Probe />); });
    await act(async () => first === 'race' ? raceRequest.resolve(race) : qualifyingRequest.resolve(qualifying));
    expect(first === 'race' ? current.raceResults : current.qualifyingResults).toHaveLength(1);
    expect(first === 'race' ? current.raceLoading : current.qualifyingLoading).toBe(false);
    expect(first === 'race' ? current.qualifyingLoading : current.raceLoading).toBe(true);
    await act(async () => first === 'race' ? qualifyingRequest.resolve(qualifying) : raceRequest.resolve(race));
    expect(current.loading).toBe(false);
    expect(current.error).toBeNull();
  });

  it('reports a partial failure immediately and keeps successful data during retry', async () => {
    const heldRace = deferred<Race | null>();
    vi.mocked(seasonApi.getRaceResults).mockReturnValue(heldRace.promise);
    vi.mocked(seasonApi.getQualifyingResults).mockRejectedValue(new Error('offline'));
    act(() => { view = create(<Probe />); });
    await act(async () => undefined);
    expect(current.error).toBeInstanceOf(Error);
    expect(current.qualifyingLoading).toBe(false);
    expect(current.raceLoading).toBe(true);
    await act(async () => heldRace.resolve(race));
    expect(current.raceResults).toEqual(race.Results);
    vi.mocked(seasonApi.getRaceResults).mockRejectedValue(new Error('offline'));
    vi.mocked(seasonApi.getQualifyingResults).mockResolvedValue(qualifying);
    await act(async () => current.retry());
    expect(current.raceResults).toEqual(race.Results);
    expect(current.qualifyingResults).toEqual(qualifying.QualifyingResults);
    expect(current.loading).toBe(false);
  });

  it('never publishes results from the previous race or after unmount', async () => {
    const oldRace = deferred<Race | null>();
    const oldQualifying = deferred<Race | null>();
    const newRace = deferred<Race | null>();
    const newQualifying = deferred<Race | null>();
    vi.mocked(seasonApi.getRaceResults).mockReturnValueOnce(oldRace.promise).mockReturnValueOnce(newRace.promise);
    vi.mocked(seasonApi.getQualifyingResults).mockReturnValueOnce(oldQualifying.promise).mockReturnValueOnce(newQualifying.promise);
    act(() => { view = create(<Probe />); });
    act(() => view!.update(<Probe round="2" />));
    await act(async () => { oldRace.resolve(race); oldQualifying.resolve(qualifying); });
    expect(current.raceResults).toEqual([]);
    expect(current.qualifyingResults).toEqual([]);
    expect(current.raceLoading).toBe(true);
    await act(async () => newRace.resolve(race));
    expect(current.raceResults).toEqual(race.Results);
    act(() => view!.unmount());
    await act(async () => newQualifying.resolve(qualifying));
    expect(current.qualifyingResults).toEqual([]);
  });
});
