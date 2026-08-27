import { describe, it, expect } from 'vitest';
import { RaceSchema, DriverSchema, ResultSchema, QualifyingResultSchema } from './schemas';

describe('API Schemas', () => {
  it('validates a valid driver', () => {
    const result = DriverSchema.safeParse({
      driverId: 'max_verstappen',
      givenName: 'Max',
      familyName: 'Verstappen',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid driver', () => {
    const result = DriverSchema.safeParse({ name: 'test' });
    expect(result.success).toBe(false);
  });

  it('validates a valid result', () => {
    const result = ResultSchema.safeParse({
      number: '1',
      position: '1',
      positionText: '1',
      points: '25',
      grid: '1',
      laps: '57',
      status: 'Finished',
      Time: { millis: '5423123', time: '1:30:23.123' },
      FastestLap: {
        rank: '1',
        lap: '45',
        Time: { time: '1:31.456' },
        AverageSpeed: { units: 'kph', speed: '220.1' },
      },
      Driver: { driverId: 'max_verstappen', givenName: 'Max', familyName: 'Verstappen' },
      Constructor: { constructorId: 'red_bull', name: 'Red Bull' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.Time?.time).toBe('1:30:23.123');
      expect(result.data.FastestLap?.Time.time).toBe('1:31.456');
    }
  });

  it('validates a valid race', () => {
    const result = RaceSchema.safeParse({
      season: '2025',
      round: '1',
      raceName: 'Bahrain Grand Prix',
      date: '2025-03-02',
      Circuit: {
        circuitId: 'bahrain',
        circuitName: 'Bahrain International Circuit',
        Location: { country: 'Bahrain', locality: 'Sakhir', lat: '26.0325', long: '50.5106' },
      },
    });
    expect(result.success).toBe(true);
  });

  it('validates a qualifying result', () => {
    const result = QualifyingResultSchema.safeParse({
      number: '1',
      position: '1',
      Driver: { driverId: 'max_verstappen', givenName: 'Max', familyName: 'Verstappen' },
      Constructor: { constructorId: 'red_bull', name: 'Red Bull' },
      Q1: '1:30.123',
      Q2: '1:29.456',
      Q3: '1:28.789',
    });
    expect(result.success).toBe(true);
  });

  it('accepts missing optional fields', () => {
    const result = RaceSchema.safeParse({
      season: '2025',
      round: '1',
      raceName: 'Test Race',
      date: '2025-01-01',
      Circuit: {
        circuitId: 'test',
        circuitName: 'Test Circuit',
        Location: { country: 'Test', locality: 'Test', lat: '0', long: '0' },
      },
    });
    expect(result.success).toBe(true);
  });

  it('preserves race weekend session schedules', () => {
    const result = RaceSchema.parse({
      season: '2025',
      round: '2',
      raceName: 'Chinese Grand Prix',
      date: '2025-03-23',
      Circuit: {
        circuitId: 'shanghai',
        circuitName: 'Shanghai International Circuit',
        Location: { country: 'China', locality: 'Shanghai', lat: '31.3389', long: '121.2200' },
      },
      FirstPractice: { date: '2025-03-21', time: '03:30:00Z' },
      SprintQualifying: { date: '2025-03-21', time: '07:30:00Z' },
      Sprint: { date: '2025-03-22', time: '03:00:00Z' },
      Qualifying: { date: '2025-03-22', time: '07:00:00Z' },
    });

    expect(result.SprintQualifying).toEqual({ date: '2025-03-21', time: '07:30:00Z' });
    expect(result.Sprint).toEqual({ date: '2025-03-22', time: '03:00:00Z' });
  });
});
