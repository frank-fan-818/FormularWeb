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
  return commonComplete && raceComplete && qualifyingComplete;
}
