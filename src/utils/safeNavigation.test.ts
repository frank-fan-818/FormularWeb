import { describe, expect, it } from 'vitest';
import { isSafeInternalRoute } from './safeNavigation';

describe('isSafeInternalRoute', () => {
  it.each([
    '/',
    '/races/1',
    '/drivers/max_verstappen?tab=results',
    '/privacy#data-use',
  ])('allows the internal route %s', (route) => {
    expect(isSafeInternalRoute(route)).toBe(true);
  });

  it.each([
    'https://evil.example',
    '//evil.example',
    String.raw`\\evil.example`,
    String.raw`/\evil.example`,
    '/%5cevil.example',
    '/%255cevil.example',
    '/races/%0ahttps://evil.example',
    '',
  ])('rejects the unsafe route %s', (route) => {
    expect(isSafeInternalRoute(route)).toBe(false);
  });
});
