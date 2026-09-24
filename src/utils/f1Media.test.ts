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

  it.each([
    ['rus', 'George', 'Russell', 'russell.png'],
    ['ant', 'Kimi', 'Antonelli', 'kimi_antonelli.png'],
    ['lec', 'Charles', 'Leclerc', 'leclerc.png'],
    ['ham', 'Lewis', 'Hamilton', 'hamilton.png'],
    ['ver', 'Max', 'Verstappen', 'max_verstappen.png'],
    ['nor', 'Lando', 'Norris', 'norris.png'],
    ['lin', 'Arvid', 'Lindblad', 'lindblad.png'],
    ['hul', 'Nico', 'Hülkenberg', 'hulkenberg.png'],
    ['per', 'Sergio', 'Pérez', 'perez.png'],
  ])('resolves practice identifier %s using the full driver name', (id, first, last, file) => {
    expect(getDriverMedia(id, first, last)).toMatchObject({ isDeclared: true, path: `/images/drivers/${file}` });
  });

  it('does not guess an identity from a reused code or surname', () => {
    expect(getDriverMedia('ver', 'Jos', 'Verstappen').isDeclared).toBe(false);
    expect(getDriverMedia('rus', 'Future', 'Russell').isDeclared).toBe(false);
    expect(getDriverMedia('rus').isDeclared).toBe(false);
    expect(getDriverMedia('russell', 'Incorrect', 'Name').canonicalId).toBe('russell');
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
