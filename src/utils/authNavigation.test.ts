import { describe, expect, it } from 'vitest';
import { getAuthReturnPath } from './authNavigation';

describe('getAuthReturnPath', () => {
  it('returns a safe internal destination', () => {
    expect(getAuthReturnPath({ from: '/races/4/results?season=2026' })).toBe(
      '/races/4/results?season=2026',
    );
  });

  it.each([
    undefined,
    null,
    {},
    { from: 'https://evil.example' },
    { from: '//evil.example' },
  ])('falls back to home for an unsafe state', (state) => {
    expect(getAuthReturnPath(state)).toBe('/');
  });
});
