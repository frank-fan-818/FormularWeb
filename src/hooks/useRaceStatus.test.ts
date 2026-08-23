import { describe, expect, it } from 'vitest';
import type { Race } from '@/types';
import { getRacesByStatus } from './useRaceStatus';

function race(round: string, date: string): Race {
  return {
    season: '2026',
    round,
    date,
    raceName: `Round ${round}`,
    url: '',
    Circuit: {
      circuitId: `circuit-${round}`,
      circuitName: `Circuit ${round}`,
      url: '',
      Location: {
        lat: '0',
        long: '0',
        locality: 'Test',
        country: 'Test',
      },
    },
  };
}

describe('getRacesByStatus', () => {
  it('keeps completed races out of the upcoming calendar when the season has ended', () => {
    const races = [race('1', '2024-03-01'), race('2', '2024-03-15')];

    const result = getRacesByStatus(races, new Date('2026-07-28T12:00:00'));

    expect(result.nextRace).toBeUndefined();
    expect(result.upcomingRaces).toEqual([]);
    expect(result.completedRaces).toEqual(races);
  });

  it('partitions ongoing, next, later and completed races without overlap', () => {
    const races = [
      race('1', '2026-07-01'),
      race('2', '2026-07-29'),
      race('3', '2026-08-05'),
      race('4', '2026-08-19'),
    ];

    const result = getRacesByStatus(races, new Date('2026-07-28T12:00:00'));

    expect(result.ongoingRace?.round).toBe('2');
    expect(result.nextRace?.round).toBe('3');
    expect(result.upcomingRaces.map((item) => item.round)).toEqual(['4']);
    expect(result.completedRaces.map((item) => item.round)).toEqual(['1']);
  });
});
