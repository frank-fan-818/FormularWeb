import { describe, expect, it } from 'vitest';
import { areCircuitIdsEquivalent, getCircuitIdCandidates, getSupabaseCircuitId } from './circuitIds';

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

  it.each([
    ['albert_park', 'melbourne'], ['red_bull_ring', 'spielberg'],
    ['spa', 'spa_francorchamps'], ['villeneuve', 'montreal'],
    ['rodriguez', 'mexico_city'], ['losail', 'lusail'],
    ['vegas', 'las_vegas'], ['ricard', 'paul_ricard'], ['americas', 'austin'],
  ])('finds imported history under both %s and %s', (sourceId, canonicalId) => {
    expect(areCircuitIdsEquivalent(sourceId, canonicalId)).toBe(true);
    expect(getCircuitIdCandidates(sourceId)).toEqual(expect.arrayContaining([sourceId, canonicalId]));
    expect(getCircuitIdCandidates(canonicalId)).toEqual(expect.arrayContaining([sourceId, canonicalId]));
  });

  it.each([
    ['madring', 'catalunya'], ['sepang', 'bahrain'],
    ['monza', 'imola'], ['vegas', 'caesars_palace'],
  ])('does not combine distinct venues %s and %s', (left, right) => {
    expect(areCircuitIdsEquivalent(left, right)).toBe(false);
    expect(getCircuitIdCandidates(left)).not.toContain(right);
  });
});
