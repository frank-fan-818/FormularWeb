import { describe, expect, it } from 'vitest';
import { getRaceAggregateState } from './useRaceDiagnostics';

describe('getRaceAggregateState', () => {
  it('distinguishes aggregate page states', () => {
    expect(getRaceAggregateState({ loading: true, hasRace: false, hasBlockingError: false, hasPartialError: false })).toBe('loading');
    expect(getRaceAggregateState({ loading: false, hasRace: false, hasBlockingError: true, hasPartialError: false })).toBe('blocked');
    expect(getRaceAggregateState({ loading: false, hasRace: true, hasBlockingError: false, hasPartialError: true })).toBe('partial');
    expect(getRaceAggregateState({ loading: false, hasRace: true, hasBlockingError: false, hasPartialError: false })).toBe('ready');
    expect(getRaceAggregateState({ loading: false, hasRace: false, hasBlockingError: false, hasPartialError: false })).toBe('not_found');
  });
});
