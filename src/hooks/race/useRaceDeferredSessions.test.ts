import { describe, expect, it, vi } from 'vitest';
import type { Race } from '@/types';
import {
  getDeferredSessionsToLoad,
  getSprintClassificationResults,
  loadRaceSessionWithFallback,
} from './useRaceDeferredSessions';

const race = { season: '2026', round: '1', raceName: 'Test GP' } as Race;

describe('loadRaceSessionWithFallback', () => {
  it('uses the official fallback when the optional primary source rejects', async () => {
    const fallback = vi.fn().mockResolvedValue(race);
    await expect(loadRaceSessionWithFallback(
      () => Promise.reject(new Error('database unavailable')),
      fallback,
    )).resolves.toBe(race);
    expect(fallback).toHaveBeenCalledOnce();
  });

  it('does not call the fallback when the primary source returns data', async () => {
    const fallback = vi.fn().mockResolvedValue(null);
    await expect(loadRaceSessionWithFallback(() => Promise.resolve(race), fallback)).resolves.toBe(race);
    expect(fallback).not.toHaveBeenCalled();
  });
});

describe('getDeferredSessionsToLoad', () => {
  it('loads both classifications required by the Sprint page', () => {
    expect(getDeferredSessionsToLoad(
      'sprint',
      'race',
      ['sprintQualifying', 'sprint'],
    )).toEqual(['sprintQualifying', 'sprint']);
  });

  it('does not depend on optional session discovery for a direct Sprint route', () => {
    expect(getDeferredSessionsToLoad('sprint', 'race', [])).toEqual([
      'sprintQualifying',
      'sprint',
    ]);
  });

  it('keeps Results loading scoped to its active deferred tab', () => {
    expect(getDeferredSessionsToLoad('results', 'fp2', ['fp1', 'fp2'])).toEqual(['fp2']);
  });
});

describe('getSprintClassificationResults', () => {
  it('prefers the explicit Sprint classification on a combined race payload', () => {
    const combinedRace = {
      Results: [{ position: '1', points: '25', laps: '56' }],
      SprintResults: [{ position: '1', points: '8', laps: '19' }],
    } as Race;

    expect(getSprintClassificationResults(combinedRace)).toEqual(combinedRace.SprintResults);
  });

  it('supports normalized database payloads that store the session under Results', () => {
    const normalizedRace = {
      Results: [{ position: '1', points: '8', laps: '19' }],
    } as Race;

    expect(getSprintClassificationResults(normalizedRace)).toEqual(normalizedRace.Results);
  });
});
