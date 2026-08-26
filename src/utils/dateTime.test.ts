import { describe, expect, it } from 'vitest';
import {
  daysUntilLocalDate,
  formatDateOnly,
  formatLocalDateTime,
  getLocalDateWindow,
  isAfterLocalDateEnd,
} from './dateTime';

describe('native date helpers', () => {
  it('keeps ISO date-only values stable without a UTC timezone shift', () => {
    expect(formatDateOnly('2026-03-08')).toBe('2026-03-08');
    expect(formatDateOnly('invalid')).toBe('-');
  });

  it('calculates calendar-day distance across a daylight-saving boundary', () => {
    expect(daysUntilLocalDate('2026-03-09', new Date(2026, 2, 7, 23, 30))).toBe(2);
  });

  it('creates the same race-weekend window as the previous implementation', () => {
    const window = getLocalDateWindow('2026-07-29');
    expect(window?.start).toBe(new Date(2026, 6, 28, 0, 0, 0, 0).getTime());
    expect(window?.end).toBe(new Date(2026, 6, 29, 23, 59, 59, 999).getTime());
    expect(isAfterLocalDateEnd('2026-07-29', new Date(2026, 6, 30))).toBe(true);
  });

  it('formats cache timestamps as local minute precision', () => {
    const value = new Date(2026, 6, 28, 9, 5).getTime();
    expect(formatLocalDateTime(value)).toBe('2026-07-28 09:05');
  });
});
