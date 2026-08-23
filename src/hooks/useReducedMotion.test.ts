import { describe, expect, it } from 'vitest';
import { getReducedMotionPreference } from './useReducedMotion';

describe('getReducedMotionPreference', () => {
  it('returns false when matchMedia is unavailable', () => {
    expect(getReducedMotionPreference(undefined)).toBe(false);
  });

  it('reads the reduced-motion media query', () => {
    let receivedQuery = '';
    const result = getReducedMotionPreference((query) => {
      receivedQuery = query;
      return { matches: true };
    });

    expect(receivedQuery).toBe('(prefers-reduced-motion: reduce)');
    expect(result).toBe(true);
  });
});

