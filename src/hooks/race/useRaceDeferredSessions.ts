import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { seasonApi } from '@/api/ergast';
import { raceSessionResultsApi } from '@/api/raceSessionResults';
import type {
  QualifyingResult,
  Race,
  RaceClassificationSessionKey,
  DeferredRaceSessionKey,
  RaceRouteSection,
  RaceSessionCode,
  Result,
} from '@/types';
import { DEFERRED_RACE_SESSION_KEYS } from '@/types';
import { mergeUniqueSessionTabs, removeSessionTabs } from '@/pages/Race/shared/sessionData';
import {
  getAvailableDeferredSessionTabs,
  getRaceIdentity,
  isRaceIdentityCurrent,
} from '@/utils/race/raceSessionState';
import { createLoggerScope, type DiagnosticLoggerScope } from '@/utils/logger';

const EMPTY_CODES: RaceSessionCode[] = [];
const EMPTY_TABS: string[] = [];
const EMPTY_ERRORS: Record<string, string> = {};
const EMPTY_RESULTS: Result[] = [];
const EMPTY_QUALIFYING_RESULTS: QualifyingResult[] = [];

interface UseRaceDeferredSessionsOptions {
  season: string;
  round: string | undefined;
  raceInfo: Race | null;
  routeSection: RaceRouteSection;
  activeSessionTab: RaceClassificationSessionKey;
  flowId?: string;
}

export async function loadRaceSessionWithFallback(
  primary: () => Promise<Race | null>,
  fallback: () => Promise<Race | null>,
  diagnostics?: DiagnosticLoggerScope | null,
  operation = 'deferred_session',
): Promise<Race | null> {
  try {
    const primaryData = await primary();
    if (primaryData) return primaryData;
    diagnostics?.log({ operation, outcome: 'degraded', source: 'supabase', reasonCode: 'source_empty' });
  } catch (error) {
    diagnostics?.log({ operation, outcome: 'degraded', source: 'supabase', error });
    // The official source remains usable when optional database data is unavailable.
  }
  const fallbackData = await fallback();
  diagnostics?.log({ operation, outcome: fallbackData ? 'succeeded' : 'empty', source: 'jolpica' });
  return fallbackData;
}

export function getDeferredSessionsToLoad(
  routeSection: RaceRouteSection,
  activeSessionTab: RaceClassificationSessionKey,
  availableTabs: string[],
): DeferredRaceSessionKey[] {
  if (routeSection === 'sprint') {
    // A direct Sprint route is itself a request to inspect both classifications.
    // Do not gate the load on optional database discovery or incomplete schedule rows.
    return ['sprintQualifying', 'sprint'];
  }
  if (routeSection === 'qualifying' && availableTabs.includes('sprintQualifying')) {
    return ['sprintQualifying'];
  }
  if (routeSection === 'results' && DEFERRED_RACE_SESSION_KEYS.includes(activeSessionTab as DeferredRaceSessionKey)) {
    return [activeSessionTab as DeferredRaceSessionKey];
  }
  return [];
}

export function getSprintClassificationResults(sessionData: Race | null): Result[] {
  return sessionData?.SprintResults || sessionData?.Results || [];
}

export function useRaceDeferredSessions({
  season,
  round,
  raceInfo,
  routeSection,
  activeSessionTab,
  flowId,
}: UseRaceDeferredSessionsOptions) {
  const [sprintResults, setSprintResults] = useState<Result[]>([]);
  const [sprintQualifyingResults, setSprintQualifyingResults] = useState<QualifyingResult[]>([]);
  const [fp1Results, setFp1Results] = useState<Result[]>([]);
  const [fp2Results, setFp2Results] = useState<Result[]>([]);
  const [fp3Results, setFp3Results] = useState<Result[]>([]);
  const [availableDbSessions, setAvailableDbSessions] = useState<RaceSessionCode[]>([]);
  const [availableIdentity, setAvailableIdentity] = useState<string | null>(null);
  const [dataIdentity, setDataIdentity] = useState<string | null>(null);
  const [loadingTabs, setLoadingTabs] = useState<string[]>([]);
  const [loadedTabs, setLoadedTabs] = useState<string[]>([]);
  const [loadErrors, setLoadErrors] = useState<Record<string, string>>({});
  const [reloadKey, setReloadKey] = useState(0);
  const [discoveryReloadKey, setDiscoveryReloadKey] = useState(0);
  const loadedTabsRef = useRef<DeferredRaceSessionKey[]>([]);
  const loadingTabsRef = useRef<DeferredRaceSessionKey[]>([]);
  const raceIdentity = getRaceIdentity(season, round);
  const diagnostics = useMemo(() => flowId ? createLoggerScope({
    flowId, feature: 'race_detail', season, round: round || '', section: routeSection,
  }) : null, [flowId, round, routeSection, season]);
  const availableCurrent = isRaceIdentityCurrent(availableIdentity, season, round);
  const dataCurrent = isRaceIdentityCurrent(dataIdentity, season, round);
  const visibleAvailableSessions = availableCurrent ? availableDbSessions : EMPTY_CODES;
  const availableTabs = useMemo(
    () => getAvailableDeferredSessionTabs(raceInfo, visibleAvailableSessions),
    [raceInfo, visibleAvailableSessions],
  );
  const sessionsToLoad = useMemo(
    () => getDeferredSessionsToLoad(routeSection, activeSessionTab, availableTabs),
    [activeSessionTab, availableTabs, routeSection],
  );
  const visibleLoadedTabs = dataCurrent ? loadedTabs : EMPTY_TABS;

  useEffect(() => {
    setSprintResults([]);
    setSprintQualifyingResults([]);
    setFp1Results([]);
    setFp2Results([]);
    setFp3Results([]);
    setAvailableDbSessions([]);
    setAvailableIdentity(null);
    setLoadingTabs([]);
    setLoadedTabs([]);
    loadingTabsRef.current = [];
    loadedTabsRef.current = [];
    setLoadErrors({});
    setDataIdentity(raceIdentity);
  }, [raceIdentity]);

  useEffect(() => {
    if (!round) return;
    let cancelled = false;
    const requestedIdentity = raceIdentity;
    diagnostics?.log({ operation: 'session_discovery', outcome: 'started', source: 'supabase' });
    void raceSessionResultsApi.getAvailableSessions(season, round)
      .then((sessions) => {
        if (!cancelled) {
          diagnostics?.log({ operation: 'session_discovery', outcome: sessions.length ? 'succeeded' : 'empty', source: 'supabase', itemCount: sessions.length });
          setAvailableDbSessions(sessions);
          setAvailableIdentity(requestedIdentity);
          setLoadErrors((current) => {
            if (!current.discovery) return current;
            const next = { ...current };
            delete next.discovery;
            return next;
          });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          diagnostics?.log({ operation: 'session_discovery', outcome: 'degraded', source: 'supabase', error });
          setAvailableDbSessions([]);
          setAvailableIdentity(requestedIdentity);
          setLoadErrors((current) => {
            if (!current.discovery) return current;
            const next = { ...current };
            delete next.discovery;
            return next;
          });
        }
      });
    return () => { cancelled = true; };
  }, [diagnostics, discoveryReloadKey, raceIdentity, round, season]);

  useEffect(() => {
    if (!round || !sessionsToLoad.length) {
      return;
    }

    let cancelled = false;
    const requestedIdentity = raceIdentity;
    const pendingSessions = sessionsToLoad.filter(
      (sessionKey) => !loadedTabsRef.current.includes(sessionKey) && !loadingTabsRef.current.includes(sessionKey),
    );
    if (!pendingSessions.length) return;
    loadingTabsRef.current = mergeUniqueSessionTabs(loadingTabsRef.current, pendingSessions) as DeferredRaceSessionKey[];
    setLoadingTabs((current) => mergeUniqueSessionTabs(current, pendingSessions));

    const load = async (sessionKey: DeferredRaceSessionKey) => {
      let sessionData: Race | null = null;
      if (sessionKey === 'sprint') {
        sessionData = await loadRaceSessionWithFallback(
          () => raceSessionResultsApi.getSprintResult(season, round),
          () => seasonApi.getSprintResults(season, round),
          diagnostics,
          'sprint_results',
        );
      } else if (sessionKey === 'sprintQualifying') {
        sessionData = await raceSessionResultsApi.getSprintQualifyingResult(season, round);
      } else if (sessionKey === 'fp1') {
        sessionData = await loadRaceSessionWithFallback(
          () => raceSessionResultsApi.getPracticeResult(season, round, 1),
          () => seasonApi.getPracticeResults(season, round, 1),
          diagnostics,
          'fp1_results',
        );
      } else if (sessionKey === 'fp2') {
        sessionData = await loadRaceSessionWithFallback(
          () => raceSessionResultsApi.getPracticeResult(season, round, 2),
          () => seasonApi.getPracticeResults(season, round, 2),
          diagnostics,
          'fp2_results',
        );
      } else if (sessionKey === 'fp3') {
        sessionData = await loadRaceSessionWithFallback(
          () => raceSessionResultsApi.getPracticeResult(season, round, 3),
          () => seasonApi.getPracticeResults(season, round, 3),
          diagnostics,
          'fp3_results',
        );
      }
      if (cancelled) return;
      const resultCount = Math.max(sessionData?.Results?.length || 0, sessionData?.QualifyingResults?.length || 0, sessionData?.SprintResults?.length || 0);
      diagnostics?.log({ operation: `${sessionKey}_state`, outcome: resultCount ? 'succeeded' : 'empty', itemCount: resultCount, session: sessionKey });
      if (sessionKey === 'sprint') setSprintResults(getSprintClassificationResults(sessionData));
      if (sessionKey === 'sprintQualifying') setSprintQualifyingResults(sessionData?.QualifyingResults || []);
      if (sessionKey === 'fp1') setFp1Results(sessionData?.Results || []);
      if (sessionKey === 'fp2') setFp2Results(sessionData?.Results || []);
      if (sessionKey === 'fp3') setFp3Results(sessionData?.Results || []);
      setDataIdentity(requestedIdentity);
      loadedTabsRef.current = mergeUniqueSessionTabs(loadedTabsRef.current, [sessionKey]) as DeferredRaceSessionKey[];
      loadingTabsRef.current = removeSessionTabs(loadingTabsRef.current, [sessionKey]) as DeferredRaceSessionKey[];
      setLoadedTabs((current) => mergeUniqueSessionTabs(current, [sessionKey]));
      setLoadErrors((current) => {
        if (!current[sessionKey]) return current;
        const next = { ...current };
        delete next[sessionKey];
        return next;
      });
      setLoadingTabs((current) => removeSessionTabs(current, [sessionKey]));
    };

    pendingSessions.forEach((sessionKey) => {
      void load(sessionKey).catch((error) => {
        if (cancelled) return;
        diagnostics?.log({ operation: `${sessionKey}_state`, outcome: 'failed', error, session: sessionKey });
        loadingTabsRef.current = removeSessionTabs(loadingTabsRef.current, [sessionKey]) as DeferredRaceSessionKey[];
        setLoadErrors((current) => ({
          ...current,
          [sessionKey]: '\u8be5\u573a\u6b21\u6570\u636e\u6682\u65f6\u672a\u80fd\u5b8c\u6574\u52a0\u8f7d',
        }));
        setLoadingTabs((current) => removeSessionTabs(current, [sessionKey]));
      });
    });

    return () => {
      cancelled = true;
      loadingTabsRef.current = removeSessionTabs(loadingTabsRef.current, pendingSessions) as DeferredRaceSessionKey[];
      setLoadingTabs((current) => removeSessionTabs(current, pendingSessions));
    };
  }, [diagnostics, raceIdentity, reloadKey, round, season, sessionsToLoad]);

  const retrySession = useCallback((sessionKey: DeferredRaceSessionKey) => {
    loadedTabsRef.current = removeSessionTabs(loadedTabsRef.current, [sessionKey]) as DeferredRaceSessionKey[];
    setLoadedTabs((current) => removeSessionTabs(current, [sessionKey]));
    setLoadErrors((current) => {
      if (!current[sessionKey]) return current;
      const next = { ...current };
      delete next[sessionKey];
      return next;
    });
    setReloadKey((value) => value + 1);
  }, []);

  const retry = useCallback(() => {
    setLoadErrors((current) => {
      const next = { ...current };
      sessionsToLoad.forEach((sessionKey) => delete next[sessionKey]);
      delete next.discovery;
      return next;
    });
    setReloadKey((value) => value + 1);
    setDiscoveryReloadKey((value) => value + 1);
  }, [sessionsToLoad]);

  return {
    sprintResults: dataCurrent ? sprintResults : EMPTY_RESULTS,
    sprintQualifyingResults: dataCurrent ? sprintQualifyingResults : EMPTY_QUALIFYING_RESULTS,
    fp1Results: dataCurrent ? fp1Results : EMPTY_RESULTS,
    fp2Results: dataCurrent ? fp2Results : EMPTY_RESULTS,
    fp3Results: dataCurrent ? fp3Results : EMPTY_RESULTS,
    availableDbSessions: visibleAvailableSessions,
    availableTabs,
    loadingSessionTabs: dataCurrent ? loadingTabs : EMPTY_TABS,
    loadedSessionTabs: visibleLoadedTabs,
    sessionLoadErrors: dataCurrent ? loadErrors : EMPTY_ERRORS,
    retryActiveSession: retry,
    retrySession,
  };
}
