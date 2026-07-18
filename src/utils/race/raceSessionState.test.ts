import { describe, expect, it } from 'vitest';
import type { Race } from '@/types';
import {
  getAvailableDeferredSessionTabs,
  getRaceRouteSection,
  isRaceIdentityCurrent,
} from './raceSessionState';

describe('getRaceRouteSection', () => {
  it('derives only route-level sections from a race URL', () => {
    expect(getRaceRouteSection('/races/3/results')).toBe('results');
    expect(getRaceRouteSection('/races/3/qualifying')).toBe('qualifying');
    expect(getRaceRouteSection('/races/3/race')).toBe('race');
    expect(getRaceRouteSection('/races/3/sprint')).toBe('sprint');
    expect(getRaceRouteSection('/races/3/info')).toBe('info');
  });

  it('falls back to results for unknown or incomplete race URLs', () => {
    expect(getRaceRouteSection('/races/3')).toBe('results');
    expect(getRaceRouteSection('/races/3/fp1')).toBe('results');
    expect(getRaceRouteSection('/')).toBe('results');
  });
});

describe('getAvailableDeferredSessionTabs', () => {
  it('merges schedule sessions with database-only sessions in UI order', () => {
    const race = {
      FirstPractice: { date: '2026-01-01', time: '10:00:00Z' },
      ThirdPractice: { date: '2026-01-03', time: '10:00:00Z' },
      Sprint: { date: '2026-01-03', time: '14:00:00Z' },
    } as Race;

    expect(getAvailableDeferredSessionTabs(race, ['FP2', 'SS', 'S'])).toEqual([
      'fp1',
      'fp2',
      'fp3',
      'sprintQualifying',
      'sprint',
    ]);
  });

  it('supports database-only session discovery when schedule fields are absent', () => {
    expect(getAvailableDeferredSessionTabs(null, ['FP1', 'SQ'])).toEqual([
      'fp1',
      'sprintQualifying',
    ]);
  });
});

describe('isRaceIdentityCurrent', () => {
  it('rejects data loaded for another season or round', () => {
    expect(isRaceIdentityCurrent('2026:1', '2026', '1')).toBe(true);
    expect(isRaceIdentityCurrent('2026:1', '2026', '2')).toBe(false);
    expect(isRaceIdentityCurrent('2025:1', '2026', '1')).toBe(false);
    expect(isRaceIdentityCurrent(null, '2026', '1')).toBe(false);
  });
});
