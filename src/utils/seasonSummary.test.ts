import { describe, expect, it } from 'vitest';
import type { ConstructorStanding, DriverStanding, Race } from '@/types';
import { buildSeasonSummary } from './seasonSummary';

const race = (round: string, date: string): Race => ({
  season: '2026',
  round,
  date,
  raceName: `Race ${round}`,
  url: '',
  Circuit: {
    circuitId: `circuit-${round}`,
    circuitName: `Circuit ${round}`,
    url: '',
    Location: { lat: '0', long: '0', locality: 'City', country: 'Country' },
  },
});

const drivers = [
  {
    position: '1', positionText: '1', points: '219', wins: '6',
    Driver: { driverId: 'leader', permanentNumber: '1', code: 'LEA', url: '', givenName: 'Lead', familyName: 'Driver', dateOfBirth: '', nationality: '' },
    Constructors: [],
  },
  {
    position: '2', positionText: '2', points: '169', wins: '2',
    Driver: { driverId: 'second', permanentNumber: '2', code: 'SEC', url: '', givenName: 'Second', familyName: 'Driver', dateOfBirth: '', nationality: '' },
    Constructors: [],
  },
] satisfies DriverStanding[];

const constructors = [
  { position: '1', positionText: '1', points: '379', wins: '8', Constructor: { constructorId: 'one', url: '', name: 'One', nationality: '' } },
  { position: '2', positionText: '2', points: '307', wins: '2', Constructor: { constructorId: 'two', url: '', name: 'Two', nationality: '' } },
] satisfies ConstructorStanding[];

describe('buildSeasonSummary', () => {
  it('derives progress, leaders, gaps, and the latest completed round', () => {
    const summary = buildSeasonSummary(
      [race('1', '2026-03-01'), race('2', '2026-04-01'), race('3', '2026-06-01')],
      drivers,
      constructors,
      new Date('2026-04-15T12:00:00Z'),
    );

    expect(summary.completedRounds).toBe(2);
    expect(summary.remainingRounds).toBe(1);
    expect(summary.latestCompletedRace?.round).toBe('2');
    expect(summary.driverLeader?.points).toBe('219');
    expect(summary.driverGap).toBe(50);
    expect(summary.constructorGap).toBe(72);
  });

  it('keeps gaps unavailable when a runner-up is missing or points are invalid', () => {
    const summary = buildSeasonSummary([], drivers.slice(0, 1), [{ ...constructors[0], points: '-' }], new Date());

    expect(summary.driverGap).toBeNull();
    expect(summary.constructorGap).toBeNull();
  });

  it('counts the current race weekend as unfinished rather than completed', () => {
    const summary = buildSeasonSummary(
      [race('12', '2026-08-23')],
      drivers,
      constructors,
      new Date('2026-08-23T03:00:00Z'),
    );

    expect(summary.completedRounds).toBe(0);
    expect(summary.remainingRounds).toBe(1);
    expect(summary.latestCompletedRace).toBeNull();
  });
});
