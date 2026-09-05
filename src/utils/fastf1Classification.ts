import type { FastF1RaceAnalytics } from '@/types';

export function hasTimedSessionClassification(payload: FastF1RaceAnalytics): boolean {
  if (/^FP[123]$/.test(payload.session)) {
    return Boolean(payload.sessionResults?.some((row) => (row.position || 0) > 0 && row.time));
  }
  if (['SQ', 'SS'].includes(payload.session)) {
    return Boolean(payload.qualifyingAnalysis?.phaseResults?.some((row) =>
      Object.values(row.phases).some((phase) => phase.time)));
  }
  return true;
}
