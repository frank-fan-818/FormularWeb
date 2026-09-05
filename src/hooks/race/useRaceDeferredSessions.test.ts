import { describe, expect, it, vi } from 'vitest';
import type { Race } from '@/types';
import {
  getDeferredSessionsToLoad,
  getSprintClassificationResults,
  loadRaceSessionWithFallback,
  loadFastF1Classification,
} from './useRaceDeferredSessions';
import { fastF1AnalyticsApi } from '@/api/fastf1Analytics';
import type { FastF1RaceAnalytics } from '@/types';

const race = { season: '2026', round: '1', raceName: 'Test GP' } as Race;

describe('FastF1 classification fallback', () => {
  it('does not present a roster-derived qualifying order as an official classification', async () => {
    vi.spyOn(fastF1AnalyticsApi, 'getRaceAnalytics').mockResolvedValue({
      season: '2026', round: '1', session: 'SQ', sessionResults: [], lapTimeSeries: [],
      qualifyingAnalysis: { phaseResults: [{ driver: 'NOR', team: 'McLaren', position: 1,
        phases: { q1: { time: '' }, q2: { time: '' }, q3: { time: '' } } }], bestLaps: [] },
    } as unknown as FastF1RaceAnalytics);
    expect(await loadFastF1Classification('2026', '1', 'SQ', race)).toBeNull();
    vi.restoreAllMocks();
  });
  it('recovers practice times from laps when classification timing fields are empty', async () => {
    vi.spyOn(fastF1AnalyticsApi, 'getRaceAnalytics').mockResolvedValue({
      season: '2026', round: '1', session: 'FP1',
      sessionResults: [],
      lapTimeSeries: [
        { driver: 'NOR', team: 'McLaren', laps: [{ lapNumber: 1, lapTimeSeconds: 92 }] },
        { driver: 'RUS', team: 'Mercedes', laps: [{ lapNumber: 1, lapTimeSeconds: 91 }] },
      ],
    } as unknown as FastF1RaceAnalytics);
    const data = await loadFastF1Classification('2026', '1', 'FP1', race);
    expect(data?.Results?.map((row) => row.Driver.code)).toEqual(['RUS', 'NOR']);
    expect(data?.Results?.[0].Time?.time).toBe('1:31.000');
    vi.restoreAllMocks();
  });

  it('keeps sprint qualifying phases distinct and does not invent times', async () => {
    vi.spyOn(fastF1AnalyticsApi, 'getRaceAnalytics').mockResolvedValue({
      season: '2026', round: '1', session: 'SQ', sessionResults: [], lapTimeSeries: [],
      qualifyingAnalysis: { phaseResults: [{ driver: 'NOR', team: 'McLaren', position: 1,
        phases: { q1: { time: '1:32.000' }, q2: { time: '1:31.000' }, q3: { time: '' } } }], bestLaps: [] },
    } as unknown as FastF1RaceAnalytics);
    const data = await loadFastF1Classification('2026', '1', 'SQ', race);
    expect(data?.QualifyingResults?.[0]).toMatchObject({ Q1: '1:32.000', Q2: '1:31.000' });
    expect(data?.QualifyingResults?.[0].Q3).toBeUndefined();
    vi.restoreAllMocks();
  });
});

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
