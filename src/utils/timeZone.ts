export const DEFAULT_TIME_ZONE_OFFSET = 8 * 60;

const STANDARD_OFFSETS = [
  ...Array.from({ length: 27 }, (_, index) => (index - 12) * 60),
  -570, -210, 210, 270, 330, 345, 390, 525, 570, 630, 765,
].sort((left, right) => left - right);

export function normalizeTimeZoneOffset(value: unknown): number {
  return typeof value === 'number' && STANDARD_OFFSETS.includes(value) ? value : DEFAULT_TIME_ZONE_OFFSET;
}

export function formatUtcOffset(offsetMinutes: number): string {
  const offset = normalizeTimeZoneOffset(offsetMinutes);
  const absolute = Math.abs(offset);
  const minutes = absolute % 60;
  return `UTC${offset < 0 ? '-' : '+'}${Math.floor(absolute / 60)}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''}`;
}

export const TIME_ZONE_OPTIONS = STANDARD_OFFSETS.map(value => ({ label: formatUtcOffset(value), value }));
