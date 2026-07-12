import { describe, expect, it } from 'vitest';
import { assertCompleteList, assertContiguousRounds, assertUniqueValues } from './dataCompleteness';

describe('data completeness guards', () => {
  it('rejects a partial upstream list', () => {
    expect(() => assertCompleteList([1], '2', 'standings')).toThrow(/partial/);
  });

  it('rejects duplicate identifiers', () => {
    expect(() => assertUniqueValues([{ id: 'a' }, { id: 'a' }], (item) => item.id, 'drivers'))
      .toThrow(/duplicate/);
  });

  it('rejects a gap in race rounds', () => {
    expect(() => assertContiguousRounds([{ round: 1 }, { round: 3 }], (item) => item.round, 'races'))
      .toThrow(/missing/);
  });
});
