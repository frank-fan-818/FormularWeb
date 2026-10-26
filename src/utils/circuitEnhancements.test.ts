import { describe, expect, it } from 'vitest';
import { formatCircuitDirection, getCircuitEnhancement } from '@/utils/circuitEnhancements';
import { getSupabaseCircuitId } from './circuitIds';

describe('circuitEnhancements', () => {
  it('shares basic circuit metadata with the race information strip', () => {
    expect(getCircuitEnhancement('americas')).toMatchObject({ turns: 20, direction: 'ANTI_CLOCKWISE', leftTurns: 11, rightTurns: 9 });
    expect(getCircuitEnhancement('hockenheimring')).toMatchObject({ turns: 17, direction: 'CLOCKWISE' });
  });
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

  it.each(['albert_park', 'villeneuve', 'red_bull_ring', 'spa', 'americas', 'rodriguez', 'vegas', 'losail', 'monaco_circuit'])(
    'resolves engineering data for both %s and its database ID', (id) => {
      const detail = getCircuitEnhancement(id);
      expect(detail.leftTurns).toBeTypeOf('number');
      expect(detail.rightTurns).toBeTypeOf('number');
      expect(detail.elevationChangeM ?? detail.elevationDescription).toBeDefined();
      expect(getCircuitEnhancement(getSupabaseCircuitId(id))).toEqual(detail);
    },
  );

  it.each(['sepang', 'madring', 'sochi', 'mugello', 'portimao'])(
    'supplies the missing engineering parameters for %s', (id) => {
      const detail = getCircuitEnhancement(id);
      expect(detail.leftTurns).toBeTypeOf('number');
      expect(detail.rightTurns).toBeTypeOf('number');
      expect(detail.elevationChangeM ?? detail.elevationDescription).toBeDefined();
      expect(detail.direction).toBeTruthy();
    },
  );
});
