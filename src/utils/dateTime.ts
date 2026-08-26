const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDateParts(value: string): [number, number, number] | null {
  const match = DATE_ONLY_PATTERN.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(year, month - 1, day);
  if (
    candidate.getFullYear() !== year
    || candidate.getMonth() !== month - 1
    || candidate.getDate() !== day
  ) {
    return null;
  }
  return [year, month, day];
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatDateOnly(value: string | number | Date): string {
  if (typeof value === 'string') {
    const parts = parseDateParts(value);
    if (parts) return `${parts[0]}-${pad(parts[1])}-${pad(parts[2])}`;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatLocalDateTime(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return `${formatDateOnly(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function getLocalDateWindow(value: string): { start: number; end: number } | null {
  const parts = parseDateParts(value);
  if (!parts) return null;
  const [year, month, day] = parts;
  return {
    start: new Date(year, month - 1, day - 1, 0, 0, 0, 0).getTime(),
    end: new Date(year, month - 1, day, 23, 59, 59, 999).getTime(),
  };
}

export function isWithinRaceWeekend(value: string, now = new Date()): boolean {
  const window = getLocalDateWindow(value);
  return Boolean(window && now.getTime() > window.start && now.getTime() < window.end);
}

export function isAfterLocalDateEnd(value: string, now = new Date()): boolean {
  const window = getLocalDateWindow(value);
  return Boolean(window && now.getTime() > window.end);
}

export function isLocalDateAfter(value: string, now = new Date()): boolean {
  const parts = parseDateParts(value);
  if (!parts) return false;
  return new Date(parts[0], parts[1] - 1, parts[2]).getTime() > now.getTime();
}

export function daysUntilLocalDate(value: string, now = new Date()): number | null {
  const parts = parseDateParts(value);
  if (!parts) return null;
  const targetDay = Date.UTC(parts[0], parts[1] - 1, parts[2]);
  const currentDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((targetDay - currentDay) / 86_400_000);
}
