import { describe, expect, it } from 'vitest';
import {
  formatCompoundWithCode,
  formatTyreLife,
  getTyreAgeLabel,
  getTyreCompoundCode,
} from '@/utils/tyreCompounds';

describe('tyreCompounds', () => {
  it('maps event slick compounds to Pirelli compound codes', () => {
    expect(getTyreCompoundCode(2025, 1, 'soft')).toBe('C5');
    expect(formatCompoundWithCode(2025, 3, 'medium')).toBe('MEDIUM C2');
    expect(formatCompoundWithCode(2025, 1, 'intermediate')).toBe('INTERMEDIATE');
  });

  it('formats tyre age labels without mojibake', () => {
    expect(getTyreAgeLabel({ freshTyre: true, startTyreLife: null })).toBe('\u65b0\u80ce');
    expect(getTyreAgeLabel({ freshTyre: false, startTyreLife: null })).toBe('\u65e7\u80ce');
    expect(getTyreAgeLabel({ freshTyre: null, startTyreLife: 0 })).toBe('\u65b0\u80ce');
    expect(getTyreAgeLabel({ freshTyre: null, startTyreLife: 8 })).toBe('\u65e7\u80ce');
    expect(getTyreAgeLabel({ freshTyre: null, startTyreLife: null })).toBe('\u672a\u77e5');
  });

  it('formats tyre life ranges', () => {
    expect(formatTyreLife({ startTyreLife: null, endTyreLife: null })).toBeNull();
    expect(formatTyreLife({ startTyreLife: 2, endTyreLife: 8 })).toBe('2-8 laps');
    expect(formatTyreLife({ startTyreLife: null, endTyreLife: 5 })).toBe('5 laps');
  });
});
