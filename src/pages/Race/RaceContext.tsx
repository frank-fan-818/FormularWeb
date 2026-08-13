import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  useFastF1RaceAnalytics,
  useFastF1RaceTelemetry,
  useFastF1SessionAnalytics,
} from '@/hooks/useFastF1RaceAnalytics';
import { useFiaRaceUpgrades } from '@/hooks/useFiaCarUpgrades';
import {
  usePostRaceTelemetrySummary,
  useRacePreviewSummary,
} from '@/hooks/useRaceWeekendAnalytics';
import { useSeasonRacesCached } from '@/hooks/useSeasonDataCached';
import { useRaceDeferredSessions } from '@/hooks/race/useRaceDeferredSessions';
import { useRacePrimaryResults } from '@/hooks/race/useRacePrimaryResults';
import { getRaceAggregateState, useRaceDiagnostics } from '@/hooks/race/useRaceDiagnostics';
import { useAppStore } from '@/store';
import type { FiaRaceUpgradeSummary } from '@/api/fiaCarUpgrades';
import type {
  FastF1RaceAnalytics,
  FastF1TelemetryAnalysis,
  QualifyingResult,
  Race,
  RacePreviewSummary,
  RaceClassificationSessionKey,
  DeferredRaceSessionKey,
  RaceSessionCode,
  RaceWeekendMode,
  Result,
  DriverPostRaceTelemetrySummary,
} from '@/types';
import { getSupabaseCircuitId } from '@/utils/circuitIds';
import { getRaceRouteSection } from '@/utils/race/raceSessionState';
import { getRaceSeasonFromSearch } from '@/utils/raceRoute';

// ---- Types for context ----

export interface RaceDataContextValue {
  // Core identifiers
  season: string;
  round: string;
  diagnosticFlowId: string;

  // Race info
  raceInfo: Race | null;
  seasonLoading: boolean;
  primaryLoading: boolean;
  raceLoadError: Error | null;
  retryRaceData: () => void;
  isPastRace: boolean;

  // Race results
  qualifyingResults: QualifyingResult[];
  raceResults: Result[];
  sprintResults: Result[];
  sprintQualifyingResults: QualifyingResult[];
  fp1Results: Result[];
  fp2Results: Result[];
  fp3Results: Result[];
  availableDbSessions: RaceSessionCode[];

  // FastF1 analytics
  fastF1Analytics: FastF1RaceAnalytics | null;
  fastF1AnalyticsLoading: boolean;
  fastF1AnalyticsError: Error | null;
  retryFastF1Analytics: () => void;
  fastF1QualifyingAnalytics: FastF1RaceAnalytics | null;
  fastF1SprintQualifyingAnalytics: FastF1RaceAnalytics | null;
  fastF1SprintShootoutAnalytics: FastF1RaceAnalytics | null;
  fastF1SprintAnalytics: FastF1RaceAnalytics | null;

  // Telemetry & preview
  postRaceTelemetrySummary: DriverPostRaceTelemetrySummary[];
  racePreviewSummary: RacePreviewSummary | null;
  racePreviewLoading: boolean;
  racePreviewError: Error | null;
  retryRacePreview: () => void;

  // Telemetry (lazy loaded)
  fastF1Telemetry: FastF1TelemetryAnalysis | null;
  fastF1TelemetryLoading: boolean;
  fastF1TelemetryError: Error | null;
  loadFastF1Telemetry: () => void;

  // FIA upgrades
  raceUpgradeSummary: FiaRaceUpgradeSummary | null;
  raceUpgradeLoading: boolean;
  raceUpgradeError: Error | null;
  retryRaceUpgrades: () => void;

  // Weekend mode
  activeWeekendMode: RaceWeekendMode;

  // Session loading
  loadingSessionTabs: string[];
  loadedSessionTabs: string[];
  sessionLoadErrors: Record<string, string>;
  retryActiveSession: () => void;
  retrySession: (sessionKey: DeferredRaceSessionKey) => void;

  // UI state
  isMobile: boolean;
  activeSessionTab: RaceClassificationSessionKey;
  setActiveSessionTab: (tab: RaceClassificationSessionKey) => void;
}

const RaceDataContext = createContext<RaceDataContextValue | null>(null);

export function useRaceData(): RaceDataContextValue {
  const ctx = useContext(RaceDataContext);
  if (!ctx) {
    throw new Error('useRaceData must be used within a RaceDataProvider');
  }
  return ctx;
}

// ---- Provider props ----

interface RaceDataProviderProps {
  children: ReactNode;
}

export function RaceDataProvider({ children }: RaceDataProviderProps) {
  const { round } = useParams<{ round: string }>();
  const location = useLocation();
  const { currentSeason } = useAppStore();
  const season = getRaceSeasonFromSearch(location.search, currentSeason);
  const {
    races,
    loading: seasonLoading,
    error: seasonError,
    refetch: refetchSeason,
  } = useSeasonRacesCached(season);

  // ---- State ----

  const [activeSessionTab, setActiveSessionTab] = useState<RaceClassificationSessionKey>('race');
  const [isMobile, setIsMobile] = useState(false);

  // ---- Derived ----

  const routeSection = useMemo(
    () => getRaceRouteSection(location.pathname),
    [location.pathname],
  );
  const { flowId: diagnosticFlowId, logAggregateState } = useRaceDiagnostics(season, round || '', routeSection);
  const raceInfo = races.find((race) => race.round === round && race.season === season) || null;
  const primaryResults = useRacePrimaryResults(season, round, diagnosticFlowId);
  const retryPrimaryResults = primaryResults.retry;
  const deferredSessions = useRaceDeferredSessions({
    season,
    round,
    raceInfo,
    routeSection,
    activeSessionTab,
    flowId: diagnosticFlowId,
  });
  const isPastRace = Boolean(raceInfo && dayjs().isAfter(dayjs(raceInfo.date).endOf('day')));
  // Race analytics also powers the weather summary on the information tab.
  const shouldLoadRaceFastF1 = routeSection === 'race' || routeSection === 'info';
  const {
    data: fastF1Analytics,
    loading: fastF1AnalyticsLoading,
    error: fastF1AnalyticsError,
    retry: retryFastF1Analytics,
  } = useFastF1RaceAnalytics(season, round, shouldLoadRaceFastF1, diagnosticFlowId);
  const previewCircuitId = useMemo(
    () => getSupabaseCircuitId(raceInfo?.Circuit.circuitId),
    [raceInfo],
  );
  const {
    data: racePreviewSummary,
    loading: racePreviewLoading,
    error: racePreviewError,
    retry: retryRacePreview,
  } = useRacePreviewSummary(season, round, previewCircuitId, routeSection === 'info');
  const {
    data: raceUpgradeSummary,
    loading: raceUpgradeLoading,
    error: raceUpgradeError,
    retry: retryRaceUpgrades,
  } = useFiaRaceUpgrades(season, round, routeSection === 'info');
  const postRaceTelemetrySummary = usePostRaceTelemetrySummary(fastF1Analytics);
  const defaultWeekendMode: RaceWeekendMode = useMemo(() => {
    if (!raceInfo) {
      return 'pre';
    }
    return isPastRace ? 'post' : 'pre';
  }, [isPastRace, raceInfo]);
  const activeWeekendMode = defaultWeekendMode;
  const shouldLoadFastF1Qualifying = routeSection === 'qualifying';
  const shouldLoadFastF1SprintQualifying = deferredSessions.availableTabs.includes('sprintQualifying')
    && (routeSection === 'qualifying' || routeSection === 'sprint');
  const shouldLoadFastF1Sprint = deferredSessions.availableTabs.includes('sprint')
    && routeSection === 'sprint';
  const { data: fastF1QualifyingAnalytics } = useFastF1SessionAnalytics(
    season, round, 'Q', shouldLoadFastF1Qualifying, diagnosticFlowId,
  );
  const { data: fastF1SprintQualifyingAnalytics } = useFastF1SessionAnalytics(
    season, round, 'SQ', shouldLoadFastF1SprintQualifying, diagnosticFlowId,
  );
  const { data: fastF1SprintShootoutAnalytics } = useFastF1SessionAnalytics(
    season, round, 'SS', shouldLoadFastF1SprintQualifying, diagnosticFlowId,
  );
  const { data: fastF1SprintAnalytics } = useFastF1SessionAnalytics(
    season, round, 'S', shouldLoadFastF1Sprint, diagnosticFlowId,
  );
  const {
    data: fastF1Telemetry,
    loading: fastF1TelemetryLoading,
    error: fastF1TelemetryError,
    load: loadFastF1Telemetry,
  } = useFastF1RaceTelemetry(season, round, 'R', diagnosticFlowId);

  // ---- Effects ----

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    setActiveSessionTab('race');
  }, [season, round]);

  const retryRaceData = useCallback(() => {
    refetchSeason();
    retryPrimaryResults();
  }, [refetchSeason, retryPrimaryResults]);

  const raceLoadError = seasonError ?? primaryResults.error;
  const aggregateState = getRaceAggregateState({
    loading: seasonLoading || primaryResults.loading,
    hasRace: Boolean(raceInfo),
    hasBlockingError: Boolean(raceLoadError),
    hasPartialError: Boolean(
      raceLoadError
      || fastF1AnalyticsError
      || racePreviewError
      || raceUpgradeError
      || fastF1TelemetryError
      || Object.keys(deferredSessions.sessionLoadErrors).length,
    ),
  });

  useEffect(() => {
    logAggregateState(
      aggregateState,
      primaryResults.raceResults.length + primaryResults.qualifyingResults.length,
    );
  }, [aggregateState, logAggregateState, primaryResults.qualifyingResults.length, primaryResults.raceResults.length]);

  const value: RaceDataContextValue = useMemo(() => ({
    season,
    round: round || '',
    diagnosticFlowId,
    raceInfo,
    seasonLoading,
    primaryLoading: primaryResults.loading,
    raceLoadError,
    retryRaceData,
    isPastRace,
    qualifyingResults: primaryResults.qualifyingResults,
    raceResults: primaryResults.raceResults,
    sprintResults: deferredSessions.sprintResults,
    sprintQualifyingResults: deferredSessions.sprintQualifyingResults,
    fp1Results: deferredSessions.fp1Results,
    fp2Results: deferredSessions.fp2Results,
    fp3Results: deferredSessions.fp3Results,
    availableDbSessions: deferredSessions.availableDbSessions,
    fastF1Analytics,
    fastF1AnalyticsLoading,
    fastF1AnalyticsError,
    retryFastF1Analytics,
    fastF1QualifyingAnalytics,
    fastF1SprintQualifyingAnalytics,
    fastF1SprintShootoutAnalytics,
    fastF1SprintAnalytics,
    postRaceTelemetrySummary,
    fastF1Telemetry,
    fastF1TelemetryLoading,
    fastF1TelemetryError,
    loadFastF1Telemetry,
    racePreviewSummary,
    racePreviewLoading,
    racePreviewError,
    retryRacePreview,
    raceUpgradeSummary,
    raceUpgradeLoading,
    raceUpgradeError,
    retryRaceUpgrades,
    activeWeekendMode,
    loadingSessionTabs: deferredSessions.loadingSessionTabs,
    loadedSessionTabs: deferredSessions.loadedSessionTabs,
    sessionLoadErrors: deferredSessions.sessionLoadErrors,
    retryActiveSession: deferredSessions.retryActiveSession,
    retrySession: deferredSessions.retrySession,
    isMobile,
    activeSessionTab,
    setActiveSessionTab,
  }), [
    season,
    round,
    diagnosticFlowId,
    raceInfo,
    seasonLoading,
    primaryResults.loading,
    raceLoadError,
    retryRaceData,
    isPastRace,
    primaryResults.qualifyingResults,
    primaryResults.raceResults,
    deferredSessions.sprintResults,
    deferredSessions.sprintQualifyingResults,
    deferredSessions.fp1Results,
    deferredSessions.fp2Results,
    deferredSessions.fp3Results,
    deferredSessions.availableDbSessions,
    fastF1Analytics,
    fastF1AnalyticsLoading,
    fastF1AnalyticsError,
    retryFastF1Analytics,
    fastF1QualifyingAnalytics,
    fastF1SprintQualifyingAnalytics,
    fastF1SprintShootoutAnalytics,
    fastF1SprintAnalytics,
    postRaceTelemetrySummary,
    fastF1Telemetry,
    fastF1TelemetryLoading,
    fastF1TelemetryError,
    loadFastF1Telemetry,
    racePreviewSummary,
    racePreviewLoading,
    racePreviewError,
    retryRacePreview,
    raceUpgradeSummary,
    raceUpgradeLoading,
    raceUpgradeError,
    retryRaceUpgrades,
    activeWeekendMode,
    deferredSessions.loadingSessionTabs,
    deferredSessions.loadedSessionTabs,
    deferredSessions.sessionLoadErrors,
    deferredSessions.retryActiveSession,
    deferredSessions.retrySession,
    isMobile,
    activeSessionTab,
  ]);

  return (
    <RaceDataContext.Provider value={value}>
      {children}
    </RaceDataContext.Provider>
  );
}
