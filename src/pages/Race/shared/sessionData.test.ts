import { describe, expect, it } from 'vitest';
import {
  getScheduledDeferredSessionTabs,
  getPendingSessionTabs,
  mergeUniqueSessionTabs,
  removeSessionTabs,
} from './sessionData';
import type { Race } from '@/types';

function makeRace(overrides: Partial<Race> = {}): Race {
  return {
    season: '2026',
    round: '1',
    url: '',
    raceName: 'Test Grand Prix',
    date: '2026-03-08',
    Circuit: {
      circuitId: 'test',
      circuitName: 'Test Circuit',
      url: '',
      Location: { lat: '0', long: '0', locality: 'Test', country: 'Test' },
    },
    ...overrides,
  };
}

describe('race session loading state', () => {
  it('only schedules tabs that are neither loaded nor already loading', () => {
    expect(getPendingSessionTabs(
      ['fp1', 'fp2', 'fp3', 'sprint'],
      ['fp1'],
      ['fp2'],
    )).toEqual(['fp3', 'sprint']);
  });

  it('merges completed tabs without duplicating existing state', () => {
    expect(mergeUniqueSessionTabs(
      ['fp1', 'fp2'],
      ['fp2', 'fp3'],
    )).toEqual(['fp1', 'fp2', 'fp3']);
  });

  it('preserves the current array reference when a merge changes nothing', () => {
    const current = ['fp1', 'fp2'];
    expect(mergeUniqueSessionTabs(current, ['fp2'])).toBe(current);
  });

  it('clears every tab owned by a completed batch', () => {
    expect(removeSessionTabs(
      ['fp1', 'fp2', 'fp3', 'sprint'],
      ['fp2', 'sprint'],
    )).toEqual(['fp1', 'fp3']);
  });

  it('preserves the current array reference when no requested tab is present', () => {
    const current = ['fp1', 'fp2'];
    expect(removeSessionTabs(current, ['sprint'])).toBe(current);
  });

  it('does not schedule sprint endpoints for a non-sprint weekend', () => {
    expect(getScheduledDeferredSessionTabs(makeRace({
      FirstPractice: { date: '2026-03-06' },
      SecondPractice: { date: '2026-03-06' },
      ThirdPractice: { date: '2026-03-07' },
    }))).toEqual(['fp1', 'fp2', 'fp3']);
  });

  it('includes sprint sessions only when the race schedule exposes them', () => {
    expect(getScheduledDeferredSessionTabs(makeRace({
      FirstPractice: { date: '2026-05-01' },
      SprintQualifying: { date: '2026-05-01' },
      Sprint: { date: '2026-05-02' },
    }))).toEqual(['fp1', 'sprintQualifying', 'sprint']);
  });
});
