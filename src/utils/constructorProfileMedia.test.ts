import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import cars from '@/data/constructor-cars.json';
import { getConstructorCar } from './constructorProfileMedia';
import { getTeamColor, normalizeConstructorId } from './teamColors';

describe('constructor profile media', () => {
  it('keeps the Racing Bulls data identity stable while resolving its display colour', () => {
    expect(normalizeConstructorId('Racing Bulls')).toBe('rb');
    expect(normalizeConstructorId('racing_bulls')).toBe('rb');
    expect(getTeamColor('racing_bulls')).toBe(getTeamColor('rb'));
  });
  it('resolves current team aliases to the correct local car', () => {
    expect(getConstructorCar('mercedes', '2026')).toBe('/images/constructors/cars/mercedes.webp');
    expect(getConstructorCar('racing_bulls', '2026')).toBe('/images/constructors/cars/rb.webp');
    expect(getConstructorCar('red_bull_racing', '2026')).toBe('/images/constructors/cars/red_bull.webp');
  });

  it('does not assign modern cars to historical constructors or other seasons', () => {
    expect(getConstructorCar('mercedes', '2024')).toBeNull();
    expect(getConstructorCar('alfa_romeo', '2026')).toBeNull();
    expect(getConstructorCar('sauber', '2026')).toBeNull();
    expect(getConstructorCar('unknown', '2026')).toBeNull();
  });

  it('ships a local WebP for all eleven cars with official source provenance', () => {
    expect(Object.keys(cars.constructors)).toHaveLength(11);
    for (const car of Object.values(cars.constructors)) {
      expect(new URL(car.source).hostname).toBe('media.formula1.com');
      expect(new URL(car.sourcePage).hostname).toBe('www.formula1.com');
      const bytes = readFileSync(resolve('public/images/constructors/cars', car.file));
      expect(bytes.subarray(0, 4).toString()).toBe('RIFF');
      expect(bytes.subarray(8, 12).toString()).toBe('WEBP');
    }
  });
});
