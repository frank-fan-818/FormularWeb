import { describe, expect, it } from 'vitest';
import { firstCircuitValue, hasCircuitValue } from './circuitValues';

describe('circuit metadata placeholders', () => {
  it.each([null, undefined, '', ' ', '-', '--', '—', ' N/A ', 'unknown', '未知', '资料待补', NaN, Infinity])(
    'rejects %s as missing data', value => expect(hasCircuitValue(value)).toBe(false),
  );
  it('preserves measured zero values', () => {
    expect(firstCircuitValue<string | number | null>(null, '资料待补', 0, 12)).toBe(0);
  });
  it('falls back past remote placeholder strings', () => {
    expect(firstCircuitValue('unknown', '--', 'CLOCKWISE')).toBe('CLOCKWISE');
  });
});
