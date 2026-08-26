import { describe, expect, it } from 'vitest';

import {
  getConstructorFallbackLabel,
  getConstructorMedia,
  getDriverFallbackInitials,
  getDriverMedia,
} from './f1Media';

describe('F1 media lookup', () => {
  it('resolves canonical driver IDs and known API aliases', () => {
    expect(getDriverMedia('antonelli').path).toBe('/images/drivers/kimi_antonelli.png');
    expect(getDriverMedia('max_verstappen').path).toBe('/images/drivers/max_verstappen.png');
    expect(getDriverMedia('arvid_lindblad').path).toBe('/images/drivers/lindblad.png');
  });

  it('keeps a deterministic path for an unknown future driver', () => {
    expect(getDriverMedia('future_driver')).toMatchObject({
      path: '/images/drivers/driver.png',
      isDeclared: false,
    });
  });

  it('derives readable initials from names or the driver ID', () => {
    expect(getDriverFallbackInitials('lindblad', 'Arvid', 'Lindblad')).toBe('AL');
    expect(getDriverFallbackInitials('future_driver')).toBe('FD');
    expect(getDriverFallbackInitials('')).toBe('DR');
  });

  it('resolves new constructors and legacy aliases', () => {
    expect(getConstructorMedia('audi').path).toBe('/images/constructors/audi.webp');
    expect(getConstructorMedia('cadillac').path).toBe('/images/constructors/cadillac.webp');
    expect(getConstructorMedia('racing_bulls').path).toBe('/images/constructors/rb.png');
    expect(getConstructorMedia('future_team').isDeclared).toBe(false);
  });

  it('derives a readable constructor monogram', () => {
    expect(getConstructorFallbackLabel('cadillac')).toBe('CA');
    expect(getConstructorFallbackLabel('aston_martin')).toBe('AM');
    expect(getConstructorFallbackLabel('')).toBe('F1');
  });
});
