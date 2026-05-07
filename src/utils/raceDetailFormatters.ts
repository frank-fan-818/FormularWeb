import type { RecentGrandPrixResult } from '@/types';

export function escapeTooltipText(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatSeconds(value: number): string {
  if (!Number.isFinite(value)) {
    return '-';
  }

  const minutes = Math.floor(value / 60);
  const seconds = value - minutes * 60;
  return `${minutes}:${seconds.toFixed(3).padStart(6, '0')}`;
}

export function formatNumber(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '-';
  }

  return value.toFixed(decimals);
}

export function formatTemperature(value: number | null | undefined): string {
  const formatted = formatNumber(value, 1);
  return formatted === '-' ? formatted : `${formatted} C`;
}

export function formatPercent(value: number | null | undefined): string {
  const formatted = formatNumber(value, 0);
  return formatted === '-' ? formatted : `${formatted}%`;
}

export function formatWindSpeed(value: number | null | undefined): string {
  const formatted = formatNumber(value, 1);
  return formatted === '-' ? formatted : `${formatted} m/s`;
}

export function formatSpeed(value: number | null | undefined): string {
  const formatted = formatNumber(value, 1);
  return formatted === '-' ? formatted : `${formatted} km/h`;
}

export function formatProbability(value: number | null | undefined): string {
  return value === null || value === undefined ? '-' : `${formatNumber(value, 0)}%`;
}

export function formatRpm(value: number | null | undefined): string {
  const formatted = formatNumber(value, 0);
  return formatted === '-' ? formatted : `${formatted} rpm`;
}

export function formatSignedNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '-';
  }

  const formatted = Math.abs(value).toFixed(decimals);
  return value > 0 ? `+${formatted}` : value < 0 ? `-${formatted}` : '0';
}

export function formatSignedSeconds(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '-';
  }

  const formatted = Math.abs(value).toFixed(3);
  return value > 0 ? `+${formatted}s` : value < 0 ? `-${formatted}s` : '0.000s';
}

export function getGapToneClassName(value: number | null | undefined): 'is-even' | 'is-faster' | 'is-slower' {
  if (value === null || value === undefined || !Number.isFinite(value) || value === 0) {
    return 'is-even';
  }

  return value < 0 ? 'is-faster' : 'is-slower';
}

export function formatPodium(result: RecentGrandPrixResult): string {
  if (!result.podium.length) {
    return '-';
  }

  return result.podium
    .map((item) => `P${item.position} ${item.driverName}`)
    .join(' / ');
}

export function formatShortDate(value: string | null | undefined): string {
  if (!value) {
    return '-';
  }

  return value.slice(0, 10);
}
