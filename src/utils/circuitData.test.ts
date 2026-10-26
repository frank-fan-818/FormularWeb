import { describe, expect, it } from 'vitest';
import { getCircuitDetails, getCircuitDetailsSync } from '@/utils/circuitData';
import profiles from '@/data/circuit-profiles.json';
import { getCircuitEnhancement } from './circuitEnhancements';

describe('circuitData', () => {
  it.each(Object.keys(profiles))('has usable basic fallback values for catalogue circuit %s', id => {
    const profile = getCircuitDetailsSync(id)!;
    expect(profile).toBeTruthy();
    expect(Number(profile.length)).toBeGreaterThan(0);
    expect(profile.turns).toBeGreaterThan(0);
    expect(profile.direction).toMatch(/^(CLOCKWISE|ANTI_CLOCKWISE)$/);
    expect(profile.firstRace).toBeGreaterThanOrEqual(1950);
    expect(profile.totalRaces).toBeGreaterThan(0);
    expect(profile.raceLaps).toBeGreaterThan(0);
    expect(Number.parseFloat(profile.totalDistance)).toBeGreaterThan(0);
    const enhancement = getCircuitEnhancement(id);
    if (enhancement.leftTurns !== undefined && enhancement.rightTurns !== undefined) {
      expect(enhancement.leftTurns + enhancement.rightTurns).toBe(profile.turns);
    }
  });
  it('returns atlas-ready metadata synchronously for circuit aliases', () => {
    expect(getCircuitDetailsSync('albert_park')).toMatchObject({
      firstRace: 1996,
      raceLaps: 58,
      length: '5.278',
    });
  });

  it('keeps the asynchronous detail API compatible', async () => {
    await expect(getCircuitDetails('melbourne')).resolves.toEqual(
      getCircuitDetailsSync('melbourne'),
    );
  });

  it('returns null for circuits without a local fallback', () => {
    expect(getCircuitDetailsSync('unknown_circuit')).toBeNull();
  });

  it.each(['spielberg', 'villeneuve', 'vegas', 'losail', 'buddh', 'ricard', 'valencia_street', 'sochi', 'portimao', 'mugello', 'adelaide', 'madring'])(
    'provides complete basic metadata for %s without a database response', (id) => {
      const details = getCircuitDetailsSync(id);
      expect(details).not.toBeNull();
      expect(Number(details?.length)).toBeGreaterThan(0);
      expect(details?.firstRace).toBeGreaterThanOrEqual(1950);
      expect(details?.totalRaces).toBeGreaterThanOrEqual(0);
      expect(details?.raceLaps).toBeGreaterThan(0);
      expect(details?.totalDistance).toMatch(/^\d+\.\d{3} km$/);
    },
  );

  it('uses published lap lengths instead of dividing the race distance by laps', () => {
    expect(getCircuitDetailsSync('monaco')?.length).toBe('3.337');
    expect(getCircuitDetailsSync('shanghai')?.length).toBe('5.451');
    expect(getCircuitDetailsSync('madring')?.length).toBe('5.414');
  });
});
