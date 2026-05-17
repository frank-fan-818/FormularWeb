import { describe, expect, it } from 'vitest';
import { formatCircuitDirection, getCircuitEnhancement } from '@/utils/circuitEnhancements';

describe('circuitEnhancements', () => {
  it('formats circuit directions without mojibake', () => {
    expect(formatCircuitDirection('CLOCKWISE')).toBe('\u987a\u65f6\u9488');
    expect(formatCircuitDirection('counter-clockwise')).toBe('\u9006\u65f6\u9488');
    expect(formatCircuitDirection(null)).toBe('\u8d44\u6599\u5f85\u8865');
  });

  it('provides direction fallbacks for current calendar circuits', () => {
    expect(getCircuitEnhancement('bahrain').direction).toBe('CLOCKWISE');
    expect(getCircuitEnhancement('austin').direction).toBe('ANTI_CLOCKWISE');
    expect(getCircuitEnhancement('valencia_street').direction).toBe('CLOCKWISE');
    expect(getCircuitEnhancement('yas_marina').direction).toBe('COUNTER_CLOCKWISE');
  });
});
