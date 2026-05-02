import { describe, expect, it } from 'vitest';
import { getCircuitIdCandidates, getSupabaseCircuitId } from './circuitIds';

describe('circuit id helpers', () => {
  it('normalizes circuit ids to the Supabase canonical id', () => {
    expect(getSupabaseCircuitId('americas')).toBe('austin');
    expect(getSupabaseCircuitId('Circuit of the Americas')).toBe('austin');
  });

  it('keeps source aliases as query candidates for imported historical races', () => {
    expect(getCircuitIdCandidates('austin')).toEqual(expect.arrayContaining([
      'austin',
      'americas',
      'cota',
      'circuit_of_the_americas',
    ]));
  });
});
