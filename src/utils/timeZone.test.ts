import { describe, expect, it } from 'vitest';
import { DEFAULT_TIME_ZONE_OFFSET, TIME_ZONE_OPTIONS, formatUtcOffset, normalizeTimeZoneOffset } from './timeZone';

describe('UTC offset preferences', () => {
  it('uses concise UTC labels including fractional offsets', () => {
    expect(DEFAULT_TIME_ZONE_OFFSET).toBe(480);
    expect([480, 0, -300, 330, 345, -210, 765].map(formatUtcOffset))
      .toEqual(['UTC+8', 'UTC+0', 'UTC-5', 'UTC+5:30', 'UTC+5:45', 'UTC-3:30', 'UTC+12:45']);
  });

  it('supports worldwide standard offsets and rejects invalid saved values', () => {
    expect(TIME_ZONE_OPTIONS[0].value).toBe(-720);
    expect(TIME_ZONE_OPTIONS[TIME_ZONE_OPTIONS.length - 1].value).toBe(840);
    expect(new Set(TIME_ZONE_OPTIONS.map(option => option.value)).size).toBe(TIME_ZONE_OPTIONS.length);
    expect(normalizeTimeZoneOffset(345)).toBe(345);
    for (const value of [undefined, null, '480', NaN, Infinity, 9999, 481]) {
      expect(normalizeTimeZoneOffset(value)).toBe(480);
    }
  });
});
