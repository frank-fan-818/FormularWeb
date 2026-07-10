import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { seasonApi } from '@/api/ergast';
import { raceSessionResultsApi } from '@/api/raceSessionResults';
import {
  useFiaRaceUpgrades,
  useFastF1RaceAnalytics,
  useFastF1RaceTelemetry,
  useFastF1SessionAnalytics,
  usePostRaceTelemetrySummary,
  useRacePreviewSummary,
  useSeasonData,
} from '@/hooks';
import { useAppStore } from '@/store';
import type { FiaRaceUpgradeSummary } from '@/api/fiaCarUpgrades';
import type {
  FastF1RaceAnalytics,
  FastF1TelemetryAnalysis,
  QualifyingResult,
  Race,
  RacePreviewSummary,
  RaceWeekendMode,
  Result,
  DriverPostRaceTelemetrySummary,
} from '@/types';
import { getSupabaseCircuitId } from '@/utils/circuitIds';
import {
  getPendingSessionTabs,
  getScheduledDeferredSessionTabs,
  mergeUniqueSessionTabs,
  removeSessionTabs,
} from '@/pages/Race/shared/sessionData';

// ---- Types for context ----

type DataViewMode = 'chart' | 'table';
type TelemetryMetric = 'throttle' | 'brake' | 'gear' | 'rpm';

interface DataViewModesState {
  telemetrySummary: DataViewMode;
}

interface CollapsedDataPanelsState {
  recentResults: boolean;
  interruptionRisk: boolean;
  telemetrySummary: boolean;
  raceResults: boolean;
}

export interface RaceDataContextValue {
  // Core identifiers
  season: string;
  round: string;

  // Race info
  raceInfo: Race | null;
  seasonLoading: boolean;
  primaryLoading: boolean;
  isPastRace: boolean;

  // Race results
  qualifyingResults: QualifyingResult[];
  raceResults: Result[];
  sprintResults: Result[];
  sprintQualifyingResults: QualifyingResult[];
  fp1Results: Result[];
  fp2Results: Result[];
  fp3Results: Result[];
  availableDbSessions: string[];

  // FastF1 analytics
  fastF1Analytics: FastF1RaceAnalytics | null;
  fastF1QualifyingAnalytics: FastF1RaceAnalytics | null;
  fastF1SprintQualifyingAnalytics: FastF1RaceAnalytics | null;
  fastF1SprintShootoutAnalytics: FastF1RaceAnalytics | null;
  fastF1SprintAnalytics: FastF1RaceAnalytics | null;
  fastF1Practice1Analytics: FastF1RaceAnalytics | null;
  fastF1Practice2Analytics: FastF1RaceAnalytics | null;
  fastF1Practice3Analytics: FastF1RaceAnalytics | null;

  // Telemetry & preview
  postRaceTelemetrySummary: DriverPostRaceTelemetrySummary[];
  racePreviewSummary: RacePreviewSummary | null;
  racePreviewLoading: boolean;

  // Telemetry (lazy loaded)
  fastF1Telemetry: FastF1TelemetryAnalysis | null;
  fastF1TelemetryLoading: boolean;
  loadFastF1Telemetry: () => void;

  // FIA upgrades
  raceUpgradeSummary: FiaRaceUpgradeSummary | null;
  raceUpgradeLoading: boolean;
  raceUpgradeError: Error | null;

  // Weekend mode
  selectedWeekendMode: RaceWeekendMode | null;
  activeWeekendMode: RaceWeekendMode;
  setSelectedWeekendMode: (mode: RaceWeekendMode | null) => void;

  // Session loading
  loadingSessionTabs: string[];
  loadedSessionTabs: string[];

  // UI state
  isMobile: boolean;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  selectedLapDrivers: string[];
  selectedDuelDrivers: string[];
  selectedTelemetryDrivers: string[];
  selectedTelemetryMetrics: TelemetryMetric[];
  dataViewModes: DataViewModesState;
  collapsedDataPanels: CollapsedDataPanelsState;

  // Handlers
  setSelectedLapDrivers: (drivers: string[]) => void;
  setSelectedDuelDrivers: (drivers: string[]) => void;
  setSelectedTelemetryDrivers: (drivers: string[]) => void;
  setSelectedTelemetryMetrics: (metrics: TelemetryMetric[]) => void;
  setDataViewModes: React.Dispatch<React.SetStateAction<DataViewModesState>>;
  setCollapsedDataPanels: React.Dispatch<React.SetStateAction<CollapsedDataPanelsState>>;
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
  const { currentSeason } = useAppStore();
  const { races, loading: seasonLoading } = useSeasonData(currentSeason);

  // ---- State ----

  const [qualifyingResults, setQualifyingResults] = useState<QualifyingResult[]>([]);
  const [raceResults, setRaceResults] = useState<Result[]>([]);
  const [sprintResults, setSprintResults] = useState<Result[]>([]);
  const [sprintQualifyingResults, setSprintQualifyingResults] = useState<QualifyingResult[]>([]);
  const [fp1Results, setFp1Results] = useState<Result[]>([]);
  const [fp2Results, setFp2Results] = useState<Result[]>([]);
  const [fp3Results, setFp3Results] = useState<Result[]>([]);
  const [availableDbSessions, setAvailableDbSessions] = useState<string[]>([]);
  const [primaryLoading, setPrimaryLoading] = useState(false);
  const [loadingSessionTabs, setLoadingSessionTabs] = useState<string[]>([]);
  const [loadedSessionTabs, setLoadedSessionTabs] = useState<string[]>([]);
  const loadingSessionTabsRef = useRef<string[]>([]);
  const loadedSessionTabsRef = useRef<string[]>([]);
  const [activeTab, setActiveTab] = useState('qualifying');
  const [isMobile, setIsMobile] = useState(false);
  const [selectedLapDrivers, setSelectedLapDrivers] = useState<string[]>([]);
  const [selectedDuelDrivers, setSelectedDuelDrivers] = useState<string[]>([]);
  const [selectedTelemetryDrivers, setSelectedTelemetryDrivers] = useState<string[]>([]);
  const [selectedTelemetryMetrics, setSelectedTelemetryMetrics] = useState<TelemetryMetric[]>([
    'throttle',
    'brake',
    'gear',
    'rpm',
  ]);
  const [selectedWeekendMode, setSelectedWeekendMode] = useState<RaceWeekendMode | null>(null);
  const [dataViewModes, setDataViewModes] = useState<DataViewModesState>({
    telemetrySummary: 'chart',
  });
  const [collapsedDataPanels, setCollapsedDataPanels] = useState<CollapsedDataPanelsState>({
    recentResults: false,
    interruptionRisk: false,
    telemetrySummary: false,
    raceResults: false,
  });

  // ---- Derived ----

  const raceInfo = races.find((race) => race.round === round) || null;
  const scheduledDeferredSessionTabs = useMemo(
    () => getScheduledDeferredSessionTabs(raceInfo),
    [raceInfo],
  );
  const isPastRace = Boolean(raceInfo && dayjs().isAfter(dayjs(raceInfo.date).endOf('day')));
  const shouldLoadRaceFastF1 = selectedWeekendMode === 'post'
    || (selectedWeekendMode === null && isPastRace);
  const { data: fastF1Analytics } = useFastF1RaceAnalytics(currentSeason, round, shouldLoadRaceFastF1);
  const previewCircuitId = useMemo(
    () => getSupabaseCircuitId(raceInfo?.Circuit.circuitId),
    [raceInfo],
  );
  const {
    data: racePreviewSummary,
    loading: racePreviewLoading,
  } = useRacePreviewSummary(currentSeason, round, previewCircuitId);
  const {
    data: raceUpgradeSummary,
    loading: raceUpgradeLoading,
    error: raceUpgradeError,
  } = useFiaRaceUpgrades(currentSeason, round);
  const postRaceTelemetrySummary = usePostRaceTelemetrySummary(fastF1Analytics);
  const defaultWeekendMode: RaceWeekendMode = useMemo(() => {
    if (!raceInfo) {
      return 'pre';
    }
    return isPastRace ? 'post' : 'pre';
  }, [isPastRace, raceInfo]);
  const activeWeekendMode = selectedWeekendMode || defaultWeekendMode;
  const shouldLoadFastF1Qualifying = activeWeekendMode === 'post' || activeTab === 'qualifying';
  const shouldLoadFastF1SprintQualifying = scheduledDeferredSessionTabs.includes('sprintQualifying')
    && (activeWeekendMode === 'post' || activeTab === 'sprintQualifying');
  const shouldLoadFastF1Sprint = scheduledDeferredSessionTabs.includes('sprint')
    && (activeWeekendMode === 'post' || activeTab === 'sprint');
  const { data: fastF1QualifyingAnalytics } = useFastF1SessionAnalytics(
    currentSeason, round, 'Q', shouldLoadFastF1Qualifying,
  );
  const { data: fastF1SprintQualifyingAnalytics } = useFastF1SessionAnalytics(
    currentSeason, round, 'SQ', shouldLoadFastF1SprintQualifying,
  );
  const { data: fastF1SprintShootoutAnalytics } = useFastF1SessionAnalytics(
    currentSeason, round, 'SS', shouldLoadFastF1SprintQualifying,
  );
  const { data: fastF1SprintAnalytics } = useFastF1SessionAnalytics(
    currentSeason, round, 'S', shouldLoadFastF1Sprint,
  );
  const { data: fastF1Practice1Analytics } = useFastF1SessionAnalytics(
    currentSeason,
    round,
    'FP1',
    scheduledDeferredSessionTabs.includes('fp1') && (activeWeekendMode === 'post' || activeTab === 'fp1'),
  );
  const { data: fastF1Practice2Analytics } = useFastF1SessionAnalytics(
    currentSeason,
    round,
    'FP2',
    scheduledDeferredSessionTabs.includes('fp2') && (activeWeekendMode === 'post' || activeTab === 'fp2'),
  );
  const { data: fastF1Practice3Analytics } = useFastF1SessionAnalytics(
    currentSeason,
    round,
    'FP3',
    scheduledDeferredSessionTabs.includes('fp3') && (activeWeekendMode === 'post' || activeTab === 'fp3'),
  );
  const {
    data: fastF1Telemetry,
    loading: fastF1TelemetryLoading,
    load: loadFastF1Telemetry,
  } = useFastF1RaceTelemetry(currentSeason, round, 'R');

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
    setSelectedLapDrivers([]);
    setSelectedDuelDrivers([]);
    setSelectedTelemetryDrivers([]);
    setSelectedTelemetryMetrics(['throttle', 'brake', 'gear', 'rpm']);
    setSelectedWeekendMode(null);
    loadedSessionTabsRef.current = [];
    loadingSessionTabsRef.current = [];
    setLoadedSessionTabs([]);
    setLoadingSessionTabs([]);
    setSprintResults([]);
    setSprintQualifyingResults([]);
    setFp1Results([]);
    setFp2Results([]);
    setFp3Results([]);
    setAvailableDbSessions([]);
  }, [currentSeason, round]);

  useEffect(() => {
    if (!round) {
      return;
    }
    let cancelled = false;
    const loadAvailableSessions = async () => {
      const sessions = await raceSessionResultsApi.getAvailableSessions(currentSeason, round);
      if (!cancelled) {
        setAvailableDbSessions(sessions);
      }
    };
    void loadAvailableSessions();
    return () => { cancelled = true; };
  }, [currentSeason, round]);

  useEffect(() => {
    if (!round) {
      return;
    }
    let cancelled = false;
    setActiveTab('qualifying');
    setQualifyingResults([]);
    setRaceResults([]);
    setPrimaryLoading(true);

    const loadPrimaryData = async () => {
      const [qualifyingData, raceResultsData] = await Promise.allSettled([
        seasonApi.getQualifyingResults(currentSeason, round),
        seasonApi.getRaceResults(currentSeason, round),
      ]);
      if (cancelled) {
        return;
      }
      setQualifyingResults(
        qualifyingData.status === 'fulfilled' ? qualifyingData.value?.QualifyingResults || [] : [],
      );
      setRaceResults(
        raceResultsData.status === 'fulfilled' ? raceResultsData.value?.Results || [] : [],
      );
      setPrimaryLoading(false);
    };
    void loadPrimaryData();
    return () => { cancelled = true; };
  }, [currentSeason, round]);

  useEffect(() => {
    if (!round || !scheduledDeferredSessionTabs.includes(activeTab) || loadedSessionTabs.includes(activeTab)) {
      return;
    }
    let cancelled = false;
    setLoadingSessionTabs((currentTabs) => {
      const nextTabs = mergeUniqueSessionTabs(currentTabs, [activeTab]);
      loadingSessionTabsRef.current = nextTabs;
      return nextTabs;
    });
    const loadDeferredSession = async () => {
      let sessionData: Race | null = null;
      if (activeTab === 'sprint') {
        sessionData = await raceSessionResultsApi.getSprintResult(currentSeason, round)
          || await seasonApi.getSprintResults(currentSeason, round);
      } else if (activeTab === 'sprintQualifying') {
        sessionData = await raceSessionResultsApi.getSprintQualifyingResult(currentSeason, round)
          || await seasonApi.getSprintQualifyingResults(currentSeason, round);
      } else if (activeTab === 'fp1') {
        sessionData = await raceSessionResultsApi.getPracticeResult(currentSeason, round, 1)
          || await seasonApi.getPracticeResults(currentSeason, round, 1);
      } else if (activeTab === 'fp2') {
        sessionData = await raceSessionResultsApi.getPracticeResult(currentSeason, round, 2)
          || await seasonApi.getPracticeResults(currentSeason, round, 2);
      } else if (activeTab === 'fp3') {
        sessionData = await raceSessionResultsApi.getPracticeResult(currentSeason, round, 3)
          || await seasonApi.getPracticeResults(currentSeason, round, 3);
      }
      if (cancelled) {
        return;
      }
      if (activeTab === 'sprint') {
        setSprintResults(sessionData?.Results || sessionData?.SprintResults || []);
      } else if (activeTab === 'sprintQualifying') {
        setSprintQualifyingResults(sessionData?.QualifyingResults || []);
      } else if (activeTab === 'fp1') {
        setFp1Results(sessionData?.Results || []);
      } else if (activeTab === 'fp2') {
        setFp2Results(sessionData?.Results || []);
      } else if (activeTab === 'fp3') {
        setFp3Results(sessionData?.Results || []);
      }
      setLoadedSessionTabs((currentTabs) => {
        const nextTabs = mergeUniqueSessionTabs(currentTabs, [activeTab]);
        loadedSessionTabsRef.current = nextTabs;
        return nextTabs;
      });
      setLoadingSessionTabs((currentTabs) => {
        const nextTabs = removeSessionTabs(currentTabs, [activeTab]);
        loadingSessionTabsRef.current = nextTabs;
        return nextTabs;
      });
    };
    loadDeferredSession().catch(() => {
      if (!cancelled) {
        setLoadedSessionTabs((currentTabs) => {
          const nextTabs = mergeUniqueSessionTabs(currentTabs, [activeTab]);
          loadedSessionTabsRef.current = nextTabs;
          return nextTabs;
        });
        setLoadingSessionTabs((currentTabs) => {
          const nextTabs = removeSessionTabs(currentTabs, [activeTab]);
          loadingSessionTabsRef.current = nextTabs;
          return nextTabs;
        });
      }
    });
    return () => { cancelled = true; };
  }, [activeTab, currentSeason, loadedSessionTabs, round, scheduledDeferredSessionTabs]);

  useEffect(() => {
    if (!round || activeWeekendMode !== 'post') {
      return;
    }
    const pendingTabs = getPendingSessionTabs(
      scheduledDeferredSessionTabs,
      loadedSessionTabsRef.current,
      loadingSessionTabsRef.current,
    );
    if (!pendingTabs.length) {
      return;
    }
    let cancelled = false;
    setLoadingSessionTabs((currentTabs) => {
      const nextTabs = mergeUniqueSessionTabs(currentTabs, pendingTabs);
      loadingSessionTabsRef.current = nextTabs;
      return nextTabs;
    });
    const loadSessionByTab = async (tabKey: string): Promise<[string, Race | null]> => {
      let sessionData: Race | null = null;
      if (tabKey === 'sprint') {
        sessionData = await raceSessionResultsApi.getSprintResult(currentSeason, round)
          || await seasonApi.getSprintResults(currentSeason, round);
      } else if (tabKey === 'sprintQualifying') {
        sessionData = await raceSessionResultsApi.getSprintQualifyingResult(currentSeason, round)
          || await seasonApi.getSprintQualifyingResults(currentSeason, round);
      } else if (tabKey === 'fp1') {
        sessionData = await raceSessionResultsApi.getPracticeResult(currentSeason, round, 1)
          || await seasonApi.getPracticeResults(currentSeason, round, 1);
      } else if (tabKey === 'fp2') {
        sessionData = await raceSessionResultsApi.getPracticeResult(currentSeason, round, 2)
          || await seasonApi.getPracticeResults(currentSeason, round, 2);
      } else if (tabKey === 'fp3') {
        sessionData = await raceSessionResultsApi.getPracticeResult(currentSeason, round, 3)
          || await seasonApi.getPracticeResults(currentSeason, round, 3);
      }
      return [tabKey, sessionData];
    };
    const loadPostRaceSessions = async () => {
      const settledSessions = await Promise.allSettled(pendingTabs.map(loadSessionByTab));
      if (cancelled) {
        return;
      }
      const completedTabs: string[] = [];
      settledSessions.forEach((result) => {
        if (result.status !== 'fulfilled') {
          return;
        }
        const [tabKey, sessionData] = result.value;
        completedTabs.push(tabKey);
        if (tabKey === 'sprint') {
          setSprintResults(sessionData?.Results || sessionData?.SprintResults || []);
        } else if (tabKey === 'sprintQualifying') {
          setSprintQualifyingResults(sessionData?.QualifyingResults || []);
        } else if (tabKey === 'fp1') {
          setFp1Results(sessionData?.Results || []);
        } else if (tabKey === 'fp2') {
          setFp2Results(sessionData?.Results || []);
        } else if (tabKey === 'fp3') {
          setFp3Results(sessionData?.Results || []);
        }
      });
      setLoadedSessionTabs((currentTabs) => {
        const nextTabs = mergeUniqueSessionTabs(currentTabs, completedTabs);
        loadedSessionTabsRef.current = nextTabs;
        return nextTabs;
      });
      setLoadingSessionTabs((currentTabs) => {
        const nextTabs = removeSessionTabs(currentTabs, pendingTabs);
        loadingSessionTabsRef.current = nextTabs;
        return nextTabs;
      });
    };
    void loadPostRaceSessions();
    return () => {
      cancelled = true;
      setLoadingSessionTabs((currentTabs) => {
        const nextTabs = removeSessionTabs(currentTabs, pendingTabs);
        loadingSessionTabsRef.current = nextTabs;
        return nextTabs;
      });
    };
  }, [activeWeekendMode, currentSeason, round, scheduledDeferredSessionTabs]);

  const value: RaceDataContextValue = useMemo(() => ({
    season: currentSeason,
    round: round || '',
    raceInfo,
    seasonLoading,
    primaryLoading,
    isPastRace,
    qualifyingResults,
    raceResults,
    sprintResults,
    sprintQualifyingResults,
    fp1Results,
    fp2Results,
    fp3Results,
    availableDbSessions,
    fastF1Analytics,
    fastF1QualifyingAnalytics,
    fastF1SprintQualifyingAnalytics,
    fastF1SprintShootoutAnalytics,
    fastF1SprintAnalytics,
    fastF1Practice1Analytics,
    fastF1Practice2Analytics,
    fastF1Practice3Analytics,
    postRaceTelemetrySummary,
    fastF1Telemetry,
    fastF1TelemetryLoading,
    loadFastF1Telemetry,
    racePreviewSummary,
    racePreviewLoading,
    raceUpgradeSummary,
    raceUpgradeLoading,
    raceUpgradeError,
    selectedWeekendMode,
    activeWeekendMode,
    setSelectedWeekendMode,
    loadingSessionTabs,
    loadedSessionTabs,
    isMobile,
    activeTab,
    setActiveTab,
    selectedLapDrivers,
    selectedDuelDrivers,
    selectedTelemetryDrivers,
    selectedTelemetryMetrics,
    dataViewModes,
    collapsedDataPanels,
    setSelectedLapDrivers,
    setSelectedDuelDrivers,
    setSelectedTelemetryDrivers,
    setSelectedTelemetryMetrics,
    setDataViewModes,
    setCollapsedDataPanels,
  }), [
    currentSeason,
    round,
    raceInfo,
    seasonLoading,
    primaryLoading,
    isPastRace,
    qualifyingResults,
    raceResults,
    sprintResults,
    sprintQualifyingResults,
    fp1Results,
    fp2Results,
    fp3Results,
    availableDbSessions,
    fastF1Analytics,
    fastF1QualifyingAnalytics,
    fastF1SprintQualifyingAnalytics,
    fastF1SprintShootoutAnalytics,
    fastF1SprintAnalytics,
    fastF1Practice1Analytics,
    fastF1Practice2Analytics,
    fastF1Practice3Analytics,
    postRaceTelemetrySummary,
    fastF1Telemetry,
    fastF1TelemetryLoading,
    loadFastF1Telemetry,
    racePreviewSummary,
    racePreviewLoading,
    raceUpgradeSummary,
    raceUpgradeLoading,
    raceUpgradeError,
    selectedWeekendMode,
    activeWeekendMode,
    setSelectedWeekendMode,
    loadingSessionTabs,
    loadedSessionTabs,
    isMobile,
    activeTab,
    setActiveTab,
    selectedLapDrivers,
    selectedDuelDrivers,
    selectedTelemetryDrivers,
    selectedTelemetryMetrics,
    dataViewModes,
    collapsedDataPanels,
    setSelectedLapDrivers,
    setSelectedDuelDrivers,
    setSelectedTelemetryDrivers,
    setSelectedTelemetryMetrics,
    setDataViewModes,
    setCollapsedDataPanels,
  ]);

  return (
    <RaceDataContext.Provider value={value}>
      {children}
    </RaceDataContext.Provider>
  );
}
