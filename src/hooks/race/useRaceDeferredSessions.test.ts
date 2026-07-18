import { describe, expect, it, vi } from 'vitest';
import type { Race } from '@/types';
import { getDeferredSessionsToLoad, loadRaceSessionWithFallback } from './useRaceDeferredSessions';

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

  it('only requests Sprint classifications that are available', () => {
    expect(getDeferredSessionsToLoad('sprint', 'race', ['sprint'])).toEqual(['sprint']);
  });

  it('keeps Results loading scoped to its active deferred tab', () => {
    expect(getDeferredSessionsToLoad('results', 'fp2', ['fp1', 'fp2'])).toEqual(['fp2']);
  });
});
