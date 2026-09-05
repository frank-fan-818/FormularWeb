export interface FastF1CompletenessPayload {
  season?: string;
  round?: string;
  session?: string;
  sessionResults?: unknown[];
  lapTimeSeries?: unknown[];
  tyreStrategies?: unknown[];
  weather?: unknown;
  telemetry?: unknown;
  qualifyingAnalysis?: unknown;
  classificationVersion?: number;
}

export function hasCompleteSplitTelemetry(
  payload: FastF1CompletenessPayload,
  expected: { season: string; round: string; session: string },
): boolean {
  return String(payload.season || '') === expected.season
    && String(payload.round || '') === expected.round
    && String(payload.session || '').toUpperCase() === expected.session.toUpperCase()
    && nestedListCount(payload.telemetry, 'drivers') > 0;
}

function listCount(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function nestedListCount(value: unknown, key: string): number {
  if (!value || typeof value !== 'object') return 0;
  return listCount((value as Record<string, unknown>)[key]);
}

export function isCompleteFastF1Payload(
  payload: FastF1CompletenessPayload,
  expected: { season: string; round: string; session: string },
  hasSplitTelemetry = false,
): boolean {
  const session = expected.session.toUpperCase();
  const identityComplete = String(payload.season || '') === expected.season
    && String(payload.round || '') === expected.round
    && String(payload.session || '').toUpperCase() === session;
  const commonComplete = identityComplete
    && listCount(payload.sessionResults) > 0
    && listCount(payload.lapTimeSeries) > 0
    && listCount(payload.tyreStrategies) > 0;
  const raceComplete = session !== 'R'
    || (nestedListCount(payload.weather, 'points') > 0
      && (nestedListCount(payload.telemetry, 'drivers') > 0 || hasSplitTelemetry));
  const qualifyingComplete = !['Q', 'SQ', 'SS'].includes(session)
    || nestedListCount(payload.qualifyingAnalysis, 'bestLaps') > 0;
  const practiceTiming = !/^FP[123]$/.test(session) || (payload.classificationVersion === 1
    && (payload.sessionResults || []).some((row) => Number(record(row).position) > 0 && Boolean(record(row).time)));
  const phases = record(payload.qualifyingAnalysis).phaseResults;
  const sprintQualifyingTiming = !['SQ', 'SS'].includes(session) || (Array.isArray(phases) && phases
    .some((row) => Object.values(record(record(row).phases)).some((phase) => Boolean(record(phase).time))));
  return commonComplete && raceComplete && qualifyingComplete && practiceTiming && sprintQualifyingTiming;
}
