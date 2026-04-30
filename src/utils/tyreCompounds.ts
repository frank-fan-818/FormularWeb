import type { FastF1StrategyStint } from '@/types';

type SlickCompound = 'SOFT' | 'MEDIUM' | 'HARD';

const SLICK_ORDER: SlickCompound[] = ['SOFT', 'MEDIUM', 'HARD'];

const EVENT_NOMINATIONS: Record<string, Partial<Record<SlickCompound, string>>> = {
  '2025:1': { HARD: 'C3', MEDIUM: 'C4', SOFT: 'C5' },
  '2025:2': { HARD: 'C2', MEDIUM: 'C3', SOFT: 'C4' },
  '2025:3': { HARD: 'C1', MEDIUM: 'C2', SOFT: 'C3' },
  '2025:4': { HARD: 'C1', MEDIUM: 'C2', SOFT: 'C3' },
  '2025:5': { HARD: 'C3', MEDIUM: 'C4', SOFT: 'C5' },
  '2025:6': { HARD: 'C3', MEDIUM: 'C4', SOFT: 'C5' },
  '2025:7': { HARD: 'C4', MEDIUM: 'C5', SOFT: 'C6' },
  '2025:15': { HARD: 'C2', MEDIUM: 'C3', SOFT: 'C4' },
  '2025:16': { HARD: 'C3', MEDIUM: 'C4', SOFT: 'C5' },
  '2025:17': { HARD: 'C4', MEDIUM: 'C5', SOFT: 'C6' },
  '2025:18': { HARD: 'C3', MEDIUM: 'C4', SOFT: 'C5' },
  '2025:19': {
    HARD: 'C1',
    MEDIUM: 'C3',
    SOFT: 'C4',
  },
  '2025:20': { HARD: 'C2', MEDIUM: 'C4', SOFT: 'C5' },
  '2025:21': { HARD: 'C2', MEDIUM: 'C3', SOFT: 'C4' },
  '2025:22': { HARD: 'C3', MEDIUM: 'C4', SOFT: 'C5' },
  '2025:23': { HARD: 'C1', MEDIUM: 'C2', SOFT: 'C3' },
  '2025:24': { HARD: 'C3', MEDIUM: 'C4', SOFT: 'C5' },
};

export function getTyreCompoundCode(
  season: string | number,
  round: string | number | undefined,
  compound: string | null | undefined,
): string | null {
  const normalizedCompound = String(compound || '').toUpperCase() as SlickCompound;

  if (!SLICK_ORDER.includes(normalizedCompound)) {
    return null;
  }

  if (round !== undefined && round !== null) {
    const eventCode = EVENT_NOMINATIONS[`${season}:${round}`]?.[normalizedCompound];
    if (eventCode) {
      return eventCode;
    }
  }

  return null;
}

export function formatCompoundWithCode(
  season: string | number,
  round: string | number | undefined,
  compound: string | null | undefined,
): string {
  const normalizedCompound = String(compound || 'UNKNOWN').toUpperCase();
  const code = getTyreCompoundCode(season, round, normalizedCompound);
  return code ? `${normalizedCompound} ${code}` : normalizedCompound;
}

export function getTyreAgeLabel(stint: Pick<FastF1StrategyStint, 'freshTyre' | 'startTyreLife'>): string {
  if (stint.freshTyre === true) {
    return '新胎';
  }

  if (stint.freshTyre === false) {
    return '旧胎';
  }

  if (typeof stint.startTyreLife === 'number' && Number.isFinite(stint.startTyreLife)) {
    return stint.startTyreLife <= 1 ? '新胎' : '旧胎';
  }

  return '新/旧未知';
}

export function formatTyreLife(stint: Pick<FastF1StrategyStint, 'startTyreLife' | 'endTyreLife'>): string | null {
  const start = typeof stint.startTyreLife === 'number' && Number.isFinite(stint.startTyreLife)
    ? stint.startTyreLife
    : null;
  const end = typeof stint.endTyreLife === 'number' && Number.isFinite(stint.endTyreLife)
    ? stint.endTyreLife
    : null;

  if (start === null && end === null) {
    return null;
  }

  if (start !== null && end !== null && start !== end) {
    return `${start}-${end} laps`;
  }

  return `${start ?? end} laps`;
}
