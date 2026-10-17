import { describe, expect, it } from 'vitest';
import type { Race } from '@/types';
import { formatShortRaceName } from './raceDisplayName';

const race = (circuitId: string, raceName: string, country = ''): Pick<Race, 'raceName' | 'Circuit'> => ({
  raceName,
  Circuit: { circuitId, circuitName: '', url: '',
    Location: { locality: '', country, lat: '', long: '' } },
});

describe('formatShortRaceName', () => {
  it('omits sponsors and event suffixes from the overview', () => {
    expect(formatShortRaceName(race('marina_bay', 'Formula 1 Singapore Airlines Singapore Grand Prix', 'Singapore'))).toBe('Singapore');
    expect(formatShortRaceName(race('suzuka', 'Japanese Grand Prix', 'Japan'))).toBe('Japan');
    expect(formatShortRaceName(race('albert_park', 'Australian Grand Prix', 'Australia'))).toBe('Australia');
  });

  it('distinguishes rounds held in the same country', () => {
    expect(['miami', 'americas', 'vegas'].map(id => formatShortRaceName(race(id, 'Grand Prix'))))
      .toEqual(['Miami', 'United States', 'Las Vegas']);
    expect(['catalunya', 'madring'].map(id => formatShortRaceName(race(id, 'Spanish Grand Prix'))))
      .toEqual(['Barcelona', 'Madrid']);
  });

  it('preserves unfamiliar venue names and handles missing races', () => {
    expect(formatShortRaceName(race('unknown', 'Portuguese Grand Prix'))).toBe('Portuguese');
    expect(formatShortRaceName(race('unknown', '新赛道大奖赛'))).toBe('新赛道');
    expect(formatShortRaceName(race('unknown', 'New Venue'))).toBe('New Venue');
    expect(formatShortRaceName(null)).toBe('--');
  });
});
