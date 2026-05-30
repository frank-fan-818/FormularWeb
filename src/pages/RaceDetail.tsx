import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Card, Segmented, Table, Tabs, Tag } from 'antd';
import { ArrowLeftOutlined, CalendarOutlined, ClockCircleOutlined, FlagOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { seasonApi } from '@/api/ergast';
import { raceSessionResultsApi } from '@/api/raceSessionResults';
import {
  useFiaRaceUpgrades,
  useFastF1RaceAnalytics,
  useFastF1SessionAnalytics,
  usePostRaceTelemetrySummary,
  useRacePreviewSummary,
  useSeasonData,
} from '@/hooks';
import type { FiaRaceUpgradeTeamSummary } from '@/api/fiaCarUpgrades';
import { useAppStore } from '@/store';
import type {
  FastF1CornerAnalysis,
  FastF1QualifyingBestLap,
  FastF1TelemetryDriver,
  FastF1WeatherLapRange,
  Race,
  RaceWeekendMode,
  RecentGrandPrixResult,
  QualifyingResult,
  Result,
  TrackInterruptionProbability,
  TrackInterruptionSample,
  DriverPostRaceTelemetrySummary,
} from '@/types';
import { getSupabaseCircuitId } from '@/utils/circuitIds';
import { getTeamColor, normalizeConstructorId } from '@/utils/teamColors';
import { formatRaceDateTimeFull, getRaceWeekendSchedule, getRaceWeekendScheduleGroups } from '@/utils/raceSchedule';
import {
  formatNumber,
  formatPercent,
  formatProbability,
  formatSeconds,
  formatShortDate,
  formatSignedNumber,
  formatSignedSeconds,
  formatSpeed,
  formatWindSpeed,
  getGapToneClassName,
} from '@/utils/raceDetailFormatters';
import { formatCompoundWithCode, getTyreAgeLabel } from '@/utils/tyreCompounds';
import {
  TEXT,
  UPGRADE_REASON_LABELS,
  TRACK_STATUS_STYLES,
  LIGHT_TAG_COLORS,
  DEFAULT_TAG_COLOR,
  DEFERRED_TAB_KEYS,
} from './RaceDetail/constants';
import {
  buildLapPaceOption,
} from './RaceDetail/charts/lapPace';
import {
  buildTyreStrategyOption,
} from './RaceDetail/charts/tyreStrategy';
import {
  buildWeatherOption,
} from './RaceDetail/charts/weather';
import {
  buildTelemetrySpeedOption,
  buildTelemetryControlOption,
  buildTelemetryHeatmapOption,
} from './RaceDetail/charts/telemetry';
import {
  buildRankingBarOption,
  getTelemetrySummaryChartRows,
} from './RaceDetail/charts/rankingBar';
import {
  getCompoundColor,
  formatSessionSeconds,
  getTelemetryDriverColor,
} from './RaceDetail/charts/helpers';
import {
  DataViewMode,
  DataViewPanel,
  TableOnlyPanel,
} from './RaceDetail/components/DataViewPanels';
import { TyreStrategyTimeline } from './RaceDetail/components/TyreStrategyTimeline';
import type { FastF1SprintLapSummary, PracticeRankingItem } from './RaceDetail/sessionData';
import {
  buildFastF1Summary,
  buildDriverLookup,
  buildConstructorLookup,
  buildFastF1QualifyingRows,
  buildFastF1SprintRows,
  getDriverLegendItems,
  getBestLapByDriver,
  getFastF1SprintLapByDriver,
  buildPracticeRanking,
} from './RaceDetail/sessionData';
import {
  getDuelDriverItems,
  getSelectedDuelDrivers,
  getDuelTyreSummaryItems,
  getDuelSectorGapItems,
  getDuelCornerRows,
  getActiveTelemetryDrivers,
} from './RaceDetail/duelAnalysis';
import './RaceDetail.css';

interface RaceTabItem {
  key: string;
  label: string;
  data: Array<Result | QualifyingResult>;
  columns: ColumnsType<Result | QualifyingResult>;
}

type TelemetryMetric = 'throttle' | 'brake' | 'gear' | 'rpm';
type DataPanelKey = 'telemetrySummary';
type CollapsiblePanelKey = DataPanelKey | 'recentResults' | 'interruptionRisk' | 'raceResults';
function driverIdToCode(driverId: string): string {
  const parts = driverId.split('_').filter(Boolean);
  const last = parts[parts.length - 1] || driverId;
  return last.slice(0, 3).toUpperCase();
}

const LazyEChartsPanel = lazy(() => import('@/components/charts/EChartsPanel'));

const TELEMETRY_METRICS: Array<{ key: TelemetryMetric; label: string }> = [
  { key: 'throttle', label: TEXT.throttle },
  { key: 'brake', label: TEXT.brake },
  { key: 'gear', label: TEXT.gear },
  { key: 'rpm', label: TEXT.rpm },
];

function formatStatRange(summary?: { min: number | null; max: number | null }) {
  if (!summary || summary.min === null || summary.max === null) {
    return '-';
  }

  return `${formatNumber(summary.min, 1)}-${formatNumber(summary.max, 1)} C`;
}

function formatLapRange(range: FastF1WeatherLapRange) {
  return range.startLap === range.endLap
    ? `L${range.startLap}`
    : `L${range.startLap}-L${range.endLap}`;
}

function formatLapRanges(ranges: FastF1WeatherLapRange[] = []) {
  if (!ranges.length) {
    return '-';
  }

  return ranges.map(formatLapRange).join(', ');
}

function getCornerSpeedRows(
  cornerAnalysis: FastF1CornerAnalysis[],
  activeDrivers: FastF1TelemetryDriver[],
) {
  if (!activeDrivers.length) {
    return [];
  }

  const activeDriverSet = new Set(activeDrivers.map((driver) => driver.driver));

  return cornerAnalysis.map((corner) => {
    const driverSpeeds = corner.drivers.filter((driver) => activeDriverSet.has(driver.driver));
    const minSpeedDelta = driverSpeeds.length === 2
      && driverSpeeds[0].minSpeedKph !== null
      && driverSpeeds[1].minSpeedKph !== null
      ? Number((driverSpeeds[0].minSpeedKph - driverSpeeds[1].minSpeedKph).toFixed(1))
      : null;

    return {
      key: `${corner.corner}-${corner.distanceM}`,
      corner: corner.corner,
      distanceM: corner.distanceM,
      drivers: driverSpeeds,
      minSpeedDelta,
    };
  });
}

function formatCornerSpeedSet(driverSpeed?: {
  entrySpeedKph: number | null;
  minSpeedKph: number | null;
  exitSpeedKph: number | null;
}) {
  if (!driverSpeed) {
    return '-';
  }

  return [
    formatNumber(driverSpeed.entrySpeedKph, 0),
    formatNumber(driverSpeed.minSpeedKph, 0),
    formatNumber(driverSpeed.exitSpeedKph, 0),
  ].join(' / ');
}

const RaceDetail = () => {
  const { t } = useTranslation();
  const { round } = useParams<{ round: string }>();
  const navigate = useNavigate();
  const { currentSeason } = useAppStore();
  const { races, loading: seasonLoading } = useSeasonData(currentSeason);

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
  const [activeTab, setActiveTab] = useState('qualifying');
  const [isMobile, setIsMobile] = useState(false);
  const [selectedLapDrivers, setSelectedLapDrivers] = useState<string[]>([]);
  const [selectedDuelDrivers, setSelectedDuelDrivers] = useState<string[]>([]);
  const [selectedTelemetryDrivers, setSelectedTelemetryDrivers] = useState<string[]>([]);
  const [selectedTelemetryMetrics, setSelectedTelemetryMetrics] = useState<TelemetryMetric[]>(
    TELEMETRY_METRICS.map((metric) => metric.key),
  );
  const [selectedWeekendMode, setSelectedWeekendMode] = useState<RaceWeekendMode | null>(null);
  const [dataViewModes, setDataViewModes] = useState<Record<DataPanelKey, DataViewMode>>({
    telemetrySummary: 'chart',
  });
  const [collapsedDataPanels, setCollapsedDataPanels] = useState<Record<CollapsiblePanelKey, boolean>>({
    recentResults: false,
    interruptionRisk: false,
    telemetrySummary: false,
    raceResults: false,
  });

  const raceInfo = races.find((race) => race.round === round) || null;
  const isPastRace = useMemo(
    () => Boolean(raceInfo && dayjs().isAfter(dayjs(raceInfo.date).endOf('day'))),
    [raceInfo],
  );
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
  const shouldLoadFastF1SprintQualifying = activeWeekendMode === 'post' || activeTab === 'sprintQualifying';
  const shouldLoadFastF1Sprint = activeWeekendMode === 'post' || activeTab === 'sprint';
  const { data: fastF1QualifyingAnalytics } = useFastF1SessionAnalytics(
    currentSeason,
    round,
    'Q',
    shouldLoadFastF1Qualifying,
  );
  const { data: fastF1SprintQualifyingAnalytics } = useFastF1SessionAnalytics(
    currentSeason,
    round,
    'SQ',
    shouldLoadFastF1SprintQualifying,
  );
  const { data: fastF1SprintShootoutAnalytics } = useFastF1SessionAnalytics(
    currentSeason,
    round,
    'SS',
    shouldLoadFastF1SprintQualifying,
  );
  const { data: fastF1SprintAnalytics } = useFastF1SessionAnalytics(
    currentSeason,
    round,
    'S',
    shouldLoadFastF1Sprint,
  );
  const shouldLoadFastF1Practice = activeWeekendMode === 'post';
  const { data: fastF1Practice1Analytics } = useFastF1SessionAnalytics(
    currentSeason,
    round,
    'FP1',
    shouldLoadFastF1Practice || activeTab === 'fp1',
  );
  const { data: fastF1Practice2Analytics } = useFastF1SessionAnalytics(
    currentSeason,
    round,
    'FP2',
    shouldLoadFastF1Practice || activeTab === 'fp2',
  );
  const { data: fastF1Practice3Analytics } = useFastF1SessionAnalytics(
    currentSeason,
    round,
    'FP3',
    shouldLoadFastF1Practice || activeTab === 'fp3',
  );
  const weekendSchedule = useMemo(() => getRaceWeekendSchedule(raceInfo, TEXT), [raceInfo]);
  const weekendScheduleGroups = useMemo(() => getRaceWeekendScheduleGroups(weekendSchedule), [weekendSchedule]);
  const lapPaceOption = useMemo(
    () => (fastF1Analytics ? buildLapPaceOption(fastF1Analytics, selectedLapDrivers) : null),
    [fastF1Analytics, selectedLapDrivers],
  );
  const tyreStrategyOption = useMemo(
    () => (fastF1Analytics
      ? buildTyreStrategyOption(fastF1Analytics, selectedDuelDrivers, currentSeason, round)
      : null),
    [currentSeason, fastF1Analytics, round, selectedDuelDrivers],
  );
  const weatherOption = useMemo(
    () => (fastF1Analytics ? buildWeatherOption(fastF1Analytics) : null),
    [fastF1Analytics],
  );
  const activeTelemetryDrivers = useMemo(
    () => getActiveTelemetryDrivers(fastF1Analytics, selectedTelemetryDrivers),
    [fastF1Analytics, selectedTelemetryDrivers],
  );
  const telemetrySpeedOption = useMemo(
    () => (fastF1Analytics ? buildTelemetrySpeedOption(fastF1Analytics, activeTelemetryDrivers) : null),
    [activeTelemetryDrivers, fastF1Analytics],
  );
  const telemetryControlOption = useMemo(
    () => (fastF1Analytics
      ? buildTelemetryControlOption(fastF1Analytics, activeTelemetryDrivers, selectedTelemetryMetrics)
      : null),
    [activeTelemetryDrivers, fastF1Analytics, selectedTelemetryMetrics],
  );
  const telemetryHeatmapOption = useMemo(
    () => (fastF1Analytics ? buildTelemetryHeatmapOption(fastF1Analytics, activeTelemetryDrivers) : null),
    [activeTelemetryDrivers, fastF1Analytics],
  );
  const telemetryDriverItems = useMemo(
    () => (fastF1Analytics?.telemetry?.drivers || []).map((driver) => ({
      driver: driver.driver,
      color: getTelemetryDriverColor(driver.driver, fastF1Analytics?.telemetry?.drivers || []),
      label: `${driver.driver} ${driver.lapTimeSeconds ? formatSeconds(driver.lapTimeSeconds) : ''}`.trim(),
    })),
    [fastF1Analytics],
  );
  const telemetryCornerRows = useMemo(
    () => getCornerSpeedRows(fastF1Analytics?.telemetry?.cornerAnalysis || [], activeTelemetryDrivers),
    [activeTelemetryDrivers, fastF1Analytics],
  );
  const fastF1Summary = useMemo(
    () => buildFastF1Summary(fastF1Analytics),
    [fastF1Analytics],
  );
  const racePreviewMetrics = useMemo(() => {
    const interruptionItems = racePreviewSummary?.interruptionProbabilities || [];
    const averageInterruptionRisk = interruptionItems.length
      ? interruptionItems.reduce((total, item) => total + (item.probabilityPct || 0), 0) / interruptionItems.length
      : null;

    return [
      { label: t('historicalRaces'), value: String(racePreviewSummary?.sampleSize || 0), detail: t('sampleSize') },
      { label: t('poleConversion'), value: formatProbability(racePreviewSummary?.poleWinConversionPct), detail: t('pole') },
      { label: t('interruptionRisk'), value: formatProbability(averageInterruptionRisk), detail: interruptionItems.map((item) => item.type).join(' / ') || '-' },
    ];
  }, [racePreviewSummary]);
  const raceUpgradeMetrics = useMemo(() => [
    {
      label: t('upgradeTotal'),
      value: String(raceUpgradeSummary?.totalDeclaredUpgradeCount || 0),
      detail: raceUpgradeSummary?.grandPrix || '-',
    },
    {
      label: t('upgradeIntensity'),
      value: String(raceUpgradeSummary?.totalDeclaredUpgradeIntensity || 0),
      detail: raceUpgradeSummary?.source || '-',
    },
    {
      label: t('upgradeTeams'),
      value: String(raceUpgradeSummary?.teams.length || 0),
      detail: raceUpgradeSummary?.sourceDocuments[0]?.title || '-',
    },
  ], [raceUpgradeSummary]);
  const driverLegendItems = useMemo(
    () => getDriverLegendItems(fastF1Analytics?.lapTimeSeries || []),
    [fastF1Analytics],
  );
  const duelDriverItems = useMemo(
    () => getDuelDriverItems(fastF1Analytics),
    [fastF1Analytics],
  );
  const activeDuelDrivers = useMemo(
    () => getSelectedDuelDrivers(fastF1Analytics, selectedDuelDrivers),
    [fastF1Analytics, selectedDuelDrivers],
  );
  const duelTyreSummaryItems = useMemo(
    () => getDuelTyreSummaryItems(fastF1Analytics, selectedDuelDrivers),
    [fastF1Analytics, selectedDuelDrivers],
  );
  const duelSectorGapItems = useMemo(
    () => getDuelSectorGapItems(fastF1QualifyingAnalytics, selectedDuelDrivers),
    [fastF1QualifyingAnalytics, selectedDuelDrivers],
  );
  const duelCornerRows = useMemo(
    () => getDuelCornerRows(fastF1Analytics, selectedDuelDrivers),
    [fastF1Analytics, selectedDuelDrivers],
  );
  const fastF1QualifyingBestLapByDriver = useMemo(
    () => getBestLapByDriver(fastF1QualifyingAnalytics),
    [fastF1QualifyingAnalytics],
  );
  const activeSprintQualifyingAnalytics = currentSeason === '2023'
    ? fastF1SprintShootoutAnalytics || fastF1SprintQualifyingAnalytics
    : fastF1SprintQualifyingAnalytics || fastF1SprintShootoutAnalytics;
  const fastF1SprintQualifyingBestLapByDriver = useMemo(
    () => getBestLapByDriver(activeSprintQualifyingAnalytics),
    [activeSprintQualifyingAnalytics],
  );
  const fastF1SprintLapByDriver = useMemo(
    () => getFastF1SprintLapByDriver(fastF1SprintAnalytics),
    [fastF1SprintAnalytics],
  );
  const practice1Ranking = useMemo(
    () => buildPracticeRanking(fastF1Practice1Analytics),
    [fastF1Practice1Analytics],
  );
  const practice2Ranking = useMemo(
    () => buildPracticeRanking(fastF1Practice2Analytics),
    [fastF1Practice2Analytics],
  );
  const practice3Ranking = useMemo(
    () => buildPracticeRanking(fastF1Practice3Analytics),
    [fastF1Practice3Analytics],
  );
  const hasLapDriverFilter = selectedLapDrivers.length > 0;
  const hasRaceAnalysisSection = Boolean(
    fastF1Analytics
    && (lapPaceOption || tyreStrategyOption || weatherOption || fastF1Analytics.telemetry),
  );

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
    setSelectedTelemetryMetrics(TELEMETRY_METRICS.map((metric) => metric.key));
    setSelectedWeekendMode(null);
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

    return () => {
      cancelled = true;
    };
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

    return () => {
      cancelled = true;
    };
  }, [currentSeason, round]);

  useEffect(() => {
    if (!round || !DEFERRED_TAB_KEYS.includes(activeTab) || loadedSessionTabs.includes(activeTab)) {
      return;
    }

    let cancelled = false;

    setLoadingSessionTabs((currentTabs) =>
      currentTabs.includes(activeTab) ? currentTabs : [...currentTabs, activeTab],
    );

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

      setLoadedSessionTabs((currentTabs) =>
        currentTabs.includes(activeTab) ? currentTabs : [...currentTabs, activeTab],
      );
      setLoadingSessionTabs((currentTabs) => currentTabs.filter((tabKey) => tabKey !== activeTab));
    };

    loadDeferredSession().catch(() => {
      if (!cancelled) {
        setLoadedSessionTabs((currentTabs) =>
          currentTabs.includes(activeTab) ? currentTabs : [...currentTabs, activeTab],
        );
        setLoadingSessionTabs((currentTabs) => currentTabs.filter((tabKey) => tabKey !== activeTab));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeTab, currentSeason, loadedSessionTabs, round]);

  useEffect(() => {
    if (!round || activeWeekendMode !== 'post') {
      return;
    }

    const pendingTabs = DEFERRED_TAB_KEYS.filter(
      (tabKey) => !loadedSessionTabs.includes(tabKey) && !loadingSessionTabs.includes(tabKey),
    );

    if (!pendingTabs.length) {
      return;
    }

    let cancelled = false;

    setLoadingSessionTabs((currentTabs) => [
      ...currentTabs,
      ...pendingTabs.filter((tabKey) => !currentTabs.includes(tabKey)),
    ]);

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

      setLoadedSessionTabs((currentTabs) => [
        ...currentTabs,
        ...completedTabs.filter((tabKey) => !currentTabs.includes(tabKey)),
      ]);
      setLoadingSessionTabs((currentTabs) => currentTabs.filter((tabKey) => !pendingTabs.includes(tabKey)));
    };

    void loadPostRaceSessions();

    return () => {
      cancelled = true;
    };
  }, [activeWeekendMode, currentSeason, loadedSessionTabs, loadingSessionTabs, round]);

  const getQualifyingColumns = (
    bestLapByDriver: Map<string, FastF1QualifyingBestLap>,
    phasePrefix = 'Q',
  ) => {
    const hasFastF1Laps = bestLapByDriver.size > 0;
    const fastF1Columns = hasFastF1Laps ? [
      {
        title: t('fastestLap'),
        key: 'fastf1FastestLap',
        width: 110,
        render: (_: unknown, record: QualifyingResult) => {
          const lap = bestLapByDriver.get(record.Driver.code);
          if (!lap) {
            return '-';
          }

          return (
            <span className={lap.isDeleted ? 'fastf1-deleted-lap' : undefined}>
              {formatSessionSeconds(lap.lapTimeSeconds)}
              {lap.isDeleted ? ' *' : ''}
            </span>
          );
        },
      },
    ] : [];

    return [
      { title: t('rank'), dataIndex: 'position', key: 'position', width: 60 },
      {
        title: t('driver'),
        key: 'driver',
        render: (_: unknown, record: QualifyingResult) => {
          const color = getTeamColor(record.Constructor.constructorId);
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  display: 'inline-block',
                  backgroundColor: color,
                  color: LIGHT_TAG_COLORS.has(color) ? '#111827' : '#fff',
                  fontWeight: 700,
                  fontSize: 12,
                  padding: '2px 6px',
                  borderRadius: 3,
                  minWidth: 36,
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
                onClick={() => navigate(`/drivers/${record.Driver.driverId}`)}
              >
                {record.Driver.code}
              </span>
              <span style={{ color: '#94a3b8', fontSize: 12 }}>{record.Constructor.name}</span>
                          </div>
          );
        },
      },
      { title: `${phasePrefix}1`, dataIndex: 'Q1', key: 'Q1', width: 80 },
      { title: `${phasePrefix}2`, dataIndex: 'Q2', key: 'Q2', width: 80 },
      { title: `${phasePrefix}3`, dataIndex: 'Q3', key: 'Q3', width: 80 },
      ...fastF1Columns,
    ];
  };

  const getRaceColumns = (
    data: Result[],
    fastF1LapByDriver: Map<string, FastF1SprintLapSummary> = new Map(),
  ) => {
    let fastestLapTime = '';
    data.forEach((result) => {
      if (result.FastestLap?.Time?.time) {
        if (!fastestLapTime || result.FastestLap.Time.time < fastestLapTime) {
          fastestLapTime = result.FastestLap.Time.time;
        }
      }
    });
    fastF1LapByDriver.forEach((summary) => {
      const time = formatSessionSeconds(summary.lapTimeSeconds);
      if (time !== '-' && (!fastestLapTime || time < fastestLapTime)) {
        fastestLapTime = time;
      }
    });

    return [
      { title: t('rank'), dataIndex: 'position', key: 'position', width: 60 },
      { title: t('grid'), dataIndex: 'grid', key: 'grid', width: 60 },
      {
        title: t('driver'),
        key: 'driver',
        render: (_: unknown, record: Result) => {
          const color = getTeamColor(record.Constructor.constructorId);
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  display: 'inline-block',
                  backgroundColor: color,
                  color: LIGHT_TAG_COLORS.has(color) ? '#111827' : '#fff',
                  fontWeight: 700,
                  fontSize: 12,
                  padding: '2px 6px',
                  borderRadius: 3,
                  minWidth: 36,
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
                onClick={() => navigate(`/drivers/${record.Driver.driverId}`)}
              >
                {record.Driver.code}
              </span>
              <span style={{ color: '#94a3b8', fontSize: 12 }}>{record.Constructor.name}</span>
                          </div>
          );
        },
      },
      { title: t('laps'), dataIndex: 'laps', key: 'laps', width: 60 },
      {
        title: t('result'),
        key: 'time',
        render: (_: unknown, record: Result) => record.Time?.time || record.status,
      },
      {
        title: t('fastestLap'),
        key: 'fastestLap',
        render: (_: unknown, record: Result) => {
          const fastF1Lap = fastF1LapByDriver.get(record.Driver.code);
          const time = record.FastestLap?.Time?.time
            || formatSessionSeconds(fastF1Lap?.lapTimeSeconds);
          if (!time || time === '-') {
            return '-';
          }

          return time === fastestLapTime ? (
            <span className="fastest-lap">{time} *</span>
          ) : time;
        },
      },
      {
        title: t('points'),
        dataIndex: 'points',
        key: 'points',
        width: 60,
        render: (points: string) => <span className="points">{points}</span>,
      },
    ];
  };

  const getPracticeColumns = (data: PracticeRankingItem[]) => {
    const bestTime = data[0]?.bestTimeSeconds ?? 0;

    return [
      { title: t('rank'), key: 'rank', width: 50, render: (_: unknown, __: unknown, index: number) => index + 1 },
      {
        title: t('driver'),
        key: 'driver',
        render: (_: unknown, record: PracticeRankingItem) => {
          const color = getTeamColor(record.constructorId);
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  display: 'inline-block',
                  backgroundColor: color,
                  color: LIGHT_TAG_COLORS.has(color) ? '#111827' : '#fff',
                  fontWeight: 700,
                  fontSize: 12,
                  padding: '2px 6px',
                  borderRadius: 3,
                  minWidth: 36,
                  textAlign: 'center',
                }}
              >
                {record.driver}
              </span>
                          </div>
          );
        },
      },
      {
        title: t('result'),
        key: 'bestTime',
        width: 90,
        render: (_: unknown, record: PracticeRankingItem) => (
          <span style={{ fontWeight: record.bestTimeSeconds === bestTime ? 700 : 400, color: record.bestTimeSeconds === bestTime ? '#a855f7' : undefined }}>
            {record.bestTime}
          </span>
        ),
      },
      {
        title: 'Gap',
        key: 'gap',
        width: 80,
        render: (_: unknown, record: PracticeRankingItem) => (
          <span style={{ color: record.gapSeconds === null ? '#22c55e' : undefined }}>
            {record.gap}
          </span>
        ),
      },
      {
        title: 'S1',
        key: 'sector1',
        width: 75,
        render: (_: unknown, record: PracticeRankingItem) => <span style={{ color: '#f59e0b' }}>{record.sector1}</span>,
      },
      {
        title: 'S2',
        key: 'sector2',
        width: 75,
        render: (_: unknown, record: PracticeRankingItem) => <span style={{ color: '#3b82f6' }}>{record.sector2}</span>,
      },
      {
        title: 'S3',
        key: 'sector3',
        width: 75,
        render: (_: unknown, record: PracticeRankingItem) => <span style={{ color: '#10b981' }}>{record.sector3}</span>,
      },
      { title: t('laps'), dataIndex: 'laps', key: 'laps', width: 55 },
    ] as ColumnsType<PracticeRankingItem>;
  };

  const driverInfoByDriverId = useMemo(() => {
    const map = new Map<string, { code: string; constructorId: string; constructorName: string }>();
    // From current race results (may be empty in pre-race mode)
    [...raceResults, ...qualifyingResults, ...sprintResults].forEach((r) => {
      if (r.Driver?.driverId && r.Driver?.code) {
        map.set(r.Driver.driverId, {
          code: r.Driver.code,
          constructorId: r.Constructor?.constructorId || '',
          constructorName: r.Constructor?.name || '',
        });
      }
    });
    // From recent historical results (always available pre and post race)
    (racePreviewSummary?.recentResults || []).forEach((item) => {
      if (item.winnerDriverId && item.winnerName && !map.has(item.winnerDriverId)) {
        map.set(item.winnerDriverId, {
          code: driverIdToCode(item.winnerDriverId),
          constructorId: item.winnerConstructorId || '',
          constructorName: item.winnerConstructorName || '',
        });
      }
      if (item.poleDriverId && item.poleName && !map.has(item.poleDriverId)) {
        map.set(item.poleDriverId, {
          code: driverIdToCode(item.poleDriverId),
          constructorId: '',
          constructorName: '',
        });
      }
      (item.podium || []).forEach((p) => {
        if (p.driverId && !map.has(p.driverId)) {
          map.set(p.driverId, {
            code: driverIdToCode(p.driverId),
            constructorId: p.constructorId || '',
            constructorName: p.constructorName || '',
          });
        }
      });
    });
    return map;
  }, [raceResults, qualifyingResults, sprintResults, racePreviewSummary]);

  if ((seasonLoading || primaryLoading) && !raceInfo) {
    return <div>{t('loading')}</div>;
  }

  if (!raceInfo) {
    return (
      <div className="race-detail-page">
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(-1)}
          className="back-button"
        >
          {t('back')}
        </Button>

        <Card>
          <p>{t('notFound')}</p>
        </Card>
      </div>
    );
  }

  const hasFp1 = Boolean(raceInfo?.FirstPractice) || availableDbSessions.includes('FP1') || fp1Results.length > 0 || practice1Ranking.length > 0;
  const hasFp2 = Boolean(raceInfo?.SecondPractice) || availableDbSessions.includes('FP2') || fp2Results.length > 0 || practice2Ranking.length > 0;
  const hasFp3 = Boolean(raceInfo?.ThirdPractice) || availableDbSessions.includes('FP3') || fp3Results.length > 0 || practice3Ranking.length > 0;
  const participantRecords = [
    ...qualifyingResults,
    ...raceResults,
    ...sprintQualifyingResults,
    ...sprintResults,
    ...fp1Results,
    ...fp2Results,
    ...fp3Results,
  ];
  const driverByCode = buildDriverLookup(participantRecords);
  const constructorByName = buildConstructorLookup(participantRecords);
  const fastF1SprintQualifyingRows = buildFastF1QualifyingRows(
    activeSprintQualifyingAnalytics,
    driverByCode,
    constructorByName,
  );
  const sprintQualifyingTableData = fastF1SprintQualifyingRows.length
    ? fastF1SprintQualifyingRows
    : sprintQualifyingResults;
  const sprintTableData = sprintResults.length
    ? sprintResults
    : buildFastF1SprintRows(fastF1SprintAnalytics, driverByCode, constructorByName);
  const hasSprintQualifying = Boolean(raceInfo?.SprintQualifying)
    || availableDbSessions.includes('SQ')
    || availableDbSessions.includes('SS')
    || sprintQualifyingTableData.length > 0;
  const hasSprint = Boolean(raceInfo?.Sprint) || availableDbSessions.includes('S') || sprintTableData.length > 0;
  const isSprintWeekend = hasSprint || hasSprintQualifying;

  const tabItems: RaceTabItem[] = [
    hasFp1 && { key: 'fp1', label: t('fp1'), data: practice1Ranking, columns: getPracticeColumns(practice1Ranking) },
    hasFp2 && { key: 'fp2', label: t('fp2'), data: practice2Ranking, columns: getPracticeColumns(practice2Ranking) },
    hasFp3 && { key: 'fp3', label: t('fp3'), data: practice3Ranking, columns: getPracticeColumns(practice3Ranking) },
    hasSprintQualifying && {
      key: 'sprintQualifying',
      label: t('sprintQualifying'),
      data: sprintQualifyingTableData,
      columns: getQualifyingColumns(fastF1SprintQualifyingBestLapByDriver, 'SQ'),
    },
    hasSprint && { key: 'sprint', label: t('sprint'), data: sprintTableData, columns: getRaceColumns(sprintTableData, fastF1SprintLapByDriver) },
    {
      key: 'qualifying',
      label: t('qualifying'),
      data: qualifyingResults,
      columns: getQualifyingColumns(fastF1QualifyingBestLapByDriver),
    },
    { key: 'race', label: t('race'), data: raceResults, columns: getRaceColumns(raceResults) },
  ].filter(Boolean) as RaceTabItem[];

  const effectiveActiveTab = tabItems.find((item) => item.key === activeTab)?.key || tabItems[0]?.key || 'race';
  const currentTabIndex = tabItems.findIndex((item) => item.key === effectiveActiveTab);
  const currentItem = tabItems.find((item) => item.key === effectiveActiveTab);
  const telemetrySummaryChartOption = buildRankingBarOption(
    t('telemetrySummary'),
    'km/h',
    getTelemetrySummaryChartRows(postRaceTelemetrySummary),
    formatSpeed,
  );
  const handlePrevTab = () => {
    if (currentTabIndex > 0) {
      setActiveTab(tabItems[currentTabIndex - 1].key);
    }
  };

  const handleNextTab = () => {
    if (currentTabIndex < tabItems.length - 1) {
      setActiveTab(tabItems[currentTabIndex + 1].key);
    }
  };

  const handleDataViewModeChange = (key: DataPanelKey, mode: DataViewMode) => {
    setDataViewModes((currentModes) => ({
      ...currentModes,
      [key]: mode,
    }));
  };

  const handleDataPanelCollapseToggle = (key: CollapsiblePanelKey) => {
    setCollapsedDataPanels((currentPanels) => ({
      ...currentPanels,
      [key]: !currentPanels[key],
    }));
  };

  const handleLapDriverToggle = (driver: string) => {
    setSelectedLapDrivers((currentDrivers) => {
      if (!currentDrivers.length) {
        return [driver];
      }

      if (currentDrivers.includes(driver)) {
        return currentDrivers.filter((item) => item !== driver);
      }

      return [...currentDrivers, driver];
    });
  };

  const handleDuelDriverToggle = (driver: string) => {
    setSelectedDuelDrivers((currentDrivers) => {
      let nextDrivers: string[];
      if (currentDrivers.includes(driver)) {
        nextDrivers = currentDrivers.filter((item) => item !== driver);
      } else if (currentDrivers.length < 2) {
        nextDrivers = [...currentDrivers, driver];
      } else {
        nextDrivers = [currentDrivers[1], driver];
      }

      setSelectedLapDrivers(nextDrivers);
      return nextDrivers;
    });
  };

  const handleTelemetryDriverToggle = (driver: string) => {
    setSelectedTelemetryDrivers((currentDrivers) => {
      if (!currentDrivers.length) {
        return [driver];
      }

      if (currentDrivers.includes(driver)) {
        return currentDrivers.filter((item) => item !== driver);
      }

      return [...currentDrivers, driver];
    });
  };

  const handleTelemetryMetricToggle = (metric: TelemetryMetric) => {
    setSelectedTelemetryMetrics((currentMetrics) => {
      if (currentMetrics.includes(metric)) {
        return currentMetrics.filter((item) => item !== metric);
      }

      return [...currentMetrics, metric];
    });
  };

  type TelemetryCornerRow = ReturnType<typeof getCornerSpeedRows>[number];
  const telemetryCornerColumns: ColumnsType<TelemetryCornerRow> = [
    {
      title: t('corner'),
      key: 'corner',
      fixed: 'left' as const,
      width: 86,
      render: (_: unknown, record: TelemetryCornerRow) => (
        <div>
          <div className="corner-label">{record.corner}</div>
          <div className="corner-distance">{formatNumber(record.distanceM, 0)} m</div>
        </div>
      ),
    },
    ...activeTelemetryDrivers.map((driver) => ({
      title: `${driver.driver} (${t('entry')}/${t('minimum')}/${t('exit')})`,
      key: `corner-${driver.driver}`,
      width: 150,
      render: (_: unknown, record: TelemetryCornerRow) =>
        formatCornerSpeedSet(record.drivers.find((item) => item.driver === driver.driver)),
    })),
  ];

  if (activeTelemetryDrivers.length === 2) {
    telemetryCornerColumns.push({
      title: `${t('delta')} ${t('minimum')}`,
      key: 'minSpeedDelta',
      width: 92,
      render: (_: unknown, record: TelemetryCornerRow) =>
        record.minSpeedDelta === null ? '-' : formatSpeed(record.minSpeedDelta),
    });
  }

  const getTableLoading = (tabKey: string, data: Array<Result | QualifyingResult | PracticeRankingItem>) => {
    if (seasonLoading || primaryLoading) {
      return true;
    }

    return DEFERRED_TAB_KEYS.includes(tabKey)
      && loadingSessionTabs.includes(tabKey)
      && data.length === 0;
  };

  const recentResultColumns = [
    {
      title: t('time'),
      key: 'season',
      width: 116,
      render: (_: unknown, record: RecentGrandPrixResult) => (
        <div className="race-history-time-cell">
          <strong>{record.season}</strong>
          <span>{formatShortDate(record.date)}</span>
        </div>
      ),
    },
    {
      title: t('winner'),
      key: 'winner',
      width: 200,
      render: (_: unknown, record: RecentGrandPrixResult) => {
        const info = record.winnerDriverId ? driverInfoByDriverId.get(record.winnerDriverId) : null;
        const color = record.winnerConstructorId
          ? getTeamColor(record.winnerConstructorId)
          : (info?.constructorId ? getTeamColor(info.constructorId) : DEFAULT_TAG_COLOR);
        const code = info?.code || (record.winnerDriverId ? driverIdToCode(record.winnerDriverId) : '');
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                display: 'inline-block',
                backgroundColor: color,
                color: LIGHT_TAG_COLORS.has(color) ? '#111827' : '#fff',
                fontWeight: 700,
                fontSize: 12,
                padding: '2px 6px',
                borderRadius: 3,
                textAlign: 'center',
              }}
            >
              {code || record.winnerName || '-'}
            </span>
          </div>
        );
      },
    },
    {
      title: t('pole'),
      key: 'pole',
      width: 160,
      render: (_: unknown, record: RecentGrandPrixResult) => {
        const info = record.poleDriverId ? driverInfoByDriverId.get(record.poleDriverId) : null;
        if (!info) {
          return <strong>{record.poleName || '-'}</strong>;
        }
        const color = info.constructorId ? getTeamColor(info.constructorId) : DEFAULT_TAG_COLOR;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              display: 'inline-block',
              backgroundColor: color,
              color: LIGHT_TAG_COLORS.has(color) ? '#111827' : '#fff',
              fontWeight: 700, fontSize: 12,
              padding: '2px 6px', borderRadius: 3,
              textAlign: 'center', minWidth: 36,
            }}>
              {info.code}
            </span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>P1</span>
          </div>
        );
      },
    },
    {
      title: t('podium'),
      key: 'podium',
      render: (_: unknown, record: RecentGrandPrixResult) => {
        if (!record.podium.length) return '-';
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {record.podium.map((item) => {
              const info = driverInfoByDriverId.get(item.driverId);
              const code = info?.code || driverIdToCode(item.driverId);
              const color = item.constructorId
                ? getTeamColor(item.constructorId)
                : (info?.constructorId ? getTeamColor(info.constructorId) : DEFAULT_TAG_COLOR);
              return (
                <span key={item.position} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>P{item.position}</span>
                  <span style={{
                    display: 'inline-block',
                    backgroundColor: color,
                    color: LIGHT_TAG_COLORS.has(color) ? '#111827' : '#fff',
                    fontWeight: 700, fontSize: 11,
                    padding: '1px 5px', borderRadius: 3,
                    textAlign: 'center',
                  }}>
                    {code}
                  </span>
                </span>
              );
            })}
          </div>
        );
      },
    },
  ];

  const interruptionColumns = [
    {
      title: t('raceStatus'),
      dataIndex: 'label',
      key: 'label',
      width: 160,
    },
    {
      title: t('probability'),
      key: 'probability',
      width: 120,
      render: (_: unknown, record: TrackInterruptionProbability) => (
        <strong>{formatProbability(record.probabilityPct)}</strong>
      ),
    },
    {
      title: t('sampleSize'),
      key: 'sampleSize',
      width: 140,
      render: (_: unknown, record: TrackInterruptionProbability) => (
        <span>
          {record.triggeredCount}
          /
          {record.sampleSize}
          {record.status === 'insufficient-data' ? ` ${t('insufficientData')}` : ''}
        </span>
      ),
    },
  ];

  const interruptionSampleColumns = [
    {
      title: t('season'),
      key: 'season',
      width: 92,
      render: (_: unknown, record: TrackInterruptionSample) => (
        <strong>{record.season}</strong>
      ),
    },
    {
      title: t('race'),
      key: 'race',
      render: (_: unknown, record: TrackInterruptionSample) => (
        <span>
          {record.raceName}
          {' '}
          R
          {record.round}
        </span>
      ),
    },
    {
      title: t('raceStatus'),
      key: 'statusTypes',
      width: 240,
      render: (_: unknown, record: TrackInterruptionSample) => (
        <div className="race-weekend-status-tags">
          {record.statusLabels.length ? record.statusLabels.map((label, index) => (
            <Tag key={`${record.season}-${record.statusTypes[index]}`} color="default">
              {label}
            </Tag>
          )) : (
            <Tag>{t('noInterruption')}</Tag>
          )}
        </div>
      ),
    },
  ];

  const telemetrySummaryColumns = [
    {
      title: t('driver'),
      key: 'driver',
      fixed: 'left' as const,
      width: 120,
      render: (_: unknown, record: DriverPostRaceTelemetrySummary) => {
        const color = record.team ? getTeamColor(normalizeConstructorId(record.team)) : DEFAULT_TAG_COLOR;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                display: 'inline-block',
                backgroundColor: color,
                color: LIGHT_TAG_COLORS.has(color) ? '#111827' : '#fff',
                fontWeight: 700,
                fontSize: 12,
                padding: '2px 6px',
                borderRadius: 3,
                minWidth: 36,
                textAlign: 'center',
              }}
            >
              {record.driver}
            </span>
                      </div>
        );
      },
    },
    {
      title: t('lap'),
      key: 'lapNumber',
      width: 82,
      render: (_: unknown, record: DriverPostRaceTelemetrySummary) =>
        record.lapNumber ? `L${record.lapNumber}` : '-',
    },
    {
      title: t('lapTime'),
      key: 'lapTimeSeconds',
      width: 110,
      render: (_: unknown, record: DriverPostRaceTelemetrySummary) =>
        formatSessionSeconds(record.lapTimeSeconds),
    },
    {
      title: t('maxSpeed'),
      dataIndex: 'maxSpeedKph',
      key: 'maxSpeedKph',
      width: 120,
      render: formatSpeed,
      sorter: (a: DriverPostRaceTelemetrySummary, b: DriverPostRaceTelemetrySummary) =>
        (a.maxSpeedKph || 0) - (b.maxSpeedKph || 0),
      defaultSortOrder: 'descend' as const,
    },
    {
      title: t('averageSpeed'),
      dataIndex: 'avgSpeedKph',
      key: 'avgSpeedKph',
      width: 120,
      render: formatSpeed,
    },
    {
      title: t('fullThrottle'),
      dataIndex: 'fullThrottlePct',
      key: 'fullThrottlePct',
      width: 110,
      render: formatPercent,
    },
    {
      title: t('averageThrottle'),
      dataIndex: 'avgThrottlePct',
      key: 'avgThrottlePct',
      width: 110,
      render: formatPercent,
    },
    {
      title: t('brake'),
      dataIndex: 'brakePct',
      key: 'brakePct',
      width: 90,
      render: formatPercent,
    },
    {
      title: t('drs'),
      dataIndex: 'drsPct',
      key: 'drsPct',
      width: 90,
      render: formatPercent,
    },
  ];

  const raceUpgradeColumns: ColumnsType<FiaRaceUpgradeTeamSummary> = [
    {
      title: t('constructor'),
      dataIndex: 'team',
      key: 'team',
      fixed: 'left' as const,
      width: 150,
      render: (team: string) => <strong className="upgrade-team-name">{team}</strong>,
    },
    {
      title: t('upgradeTotal'),
      dataIndex: 'declaredUpgradeCount',
      key: 'declaredUpgradeCount',
      width: 96,
      sorter: (a, b) => a.declaredUpgradeCount - b.declaredUpgradeCount,
    },
    {
      title: t('upgradeIntensity'),
      dataIndex: 'declaredUpgradeIntensity',
      key: 'declaredUpgradeIntensity',
      width: 96,
      sorter: (a, b) => a.declaredUpgradeIntensity - b.declaredUpgradeIntensity,
      render: (value: number, record) => (
        <span className={`upgrade-intensity-pill upgrade-intensity-${record.maxComponentImportance >= 4 ? 'high' : 'normal'}`}>
          {value}
        </span>
      ),
    },
    {
      title: t('upgradeIntent'),
      key: 'dominantReason',
      width: 120,
      render: (_: unknown, record) => (
        <Tag color={record.dominantReason === 'Performance' ? 'red' : 'blue'}>
          {UPGRADE_REASON_LABELS[record.dominantReason]}
        </Tag>
      ),
    },
    {
      title: t('upgradeComponents'),
      key: 'componentNames',
      render: (_: unknown, record) => (
        <div className="upgrade-component-tags">
          {record.componentNames.length ? record.componentNames.map((component) => (
            <span key={`${record.team}-${component}`}>{component}</span>
          )) : '-'}
        </div>
      ),
    },
    {
      title: t('upgradeSource'),
      key: 'source',
      width: 120,
      render: (_: unknown, record) => record.documentUrl ? (
        <a href={record.documentUrl} target="_blank" rel="noreferrer">
          FIA
        </a>
      ) : 'FIA',
    },
  ];

  const racePreviewPanels = (
    <div className="race-weekend-grid race-preview-grid">
      <TableOnlyPanel
        title={t('recentWinners')}
        description={t('preRaceDescription')}
        loading={racePreviewLoading}
        collapsed={collapsedDataPanels.recentResults}
        onToggleCollapse={() => handleDataPanelCollapseToggle('recentResults')}
      >
        <>
          <div className="race-weekend-metric-grid">
            {racePreviewMetrics.map((item) => (
              <span key={item.label} className="race-weekend-metric">
                <small>{item.label}</small>
                <strong>{item.value}</strong>
                <em>{item.detail}</em>
              </span>
            ))}
          </div>
          {racePreviewSummary?.recentResults.length ? (
            <Table
              className="race-history-table"
              columns={recentResultColumns}
              dataSource={racePreviewSummary.recentResults}
              rowKey={(record) => record.raceId}
              pagination={false}
              size="small"
              scroll={{ x: 'max-content' }}
            />
          ) : (
            <div className="race-weekend-empty">{t('noPreviewData')}</div>
          )}
        </>
      </TableOnlyPanel>

      <TableOnlyPanel
        title={t('interruptionRisk')}
        loading={racePreviewLoading}
        collapsed={collapsedDataPanels.interruptionRisk}
        onToggleCollapse={() => handleDataPanelCollapseToggle('interruptionRisk')}
      >
        <>
          <div className="race-weekend-risk-grid">
            {(racePreviewSummary?.interruptionProbabilities || []).map((item) => (
              <span key={item.type} className={`race-weekend-risk-item risk-${item.type.toLowerCase()}`}>
                <small>{item.label}</small>
                <strong>{formatProbability(item.probabilityPct)}</strong>
                <em>
                  {item.triggeredCount}
                  /
                  {item.sampleSize}
                  {item.status === 'insufficient-data' ? ` ${t('insufficientData')}` : ''}
                </em>
              </span>
            ))}
          </div>
          <Table
            columns={interruptionColumns}
            dataSource={racePreviewSummary?.interruptionProbabilities || []}
            rowKey={(record) => record.type}
            pagination={false}
            size="small"
          />
          <div className="race-weekend-subtable">
            <h4>{t('sampleYears')}</h4>
            <Table
              columns={interruptionSampleColumns}
              dataSource={racePreviewSummary?.interruptionSamples || []}
              rowKey={(record) => `${record.season}-${record.round}`}
              pagination={false}
              size="small"
              scroll={{ x: 'max-content' }}
            />
          </div>
        </>
      </TableOnlyPanel>

      <Card
        className="race-weekend-card upgrade-summary-card"
        title={<div className="data-view-title"><span>{t('carUpgrades')}</span><small>{t('carUpgradesDescription')}</small></div>}
        loading={raceUpgradeLoading}
      >
        <div className="race-weekend-metric-grid upgrade-metric-grid">
          {raceUpgradeMetrics.map((item) => (
            <span key={item.label} className="race-weekend-metric">
              <small>{item.label}</small>
              <strong>{item.value}</strong>
              <em>{item.detail}</em>
            </span>
          ))}
        </div>
        {raceUpgradeSummary?.teams.length ? (
          <>
            <Table
              className="upgrade-summary-table"
              columns={raceUpgradeColumns}
              dataSource={raceUpgradeSummary.teams}
              rowKey={(record) => record.team}
              pagination={false}
              size="small"
              scroll={{ x: 'max-content' }}
            />
            {raceUpgradeSummary.sourceDocuments.length ? (
              <div className="upgrade-source-list">
                {raceUpgradeSummary.sourceDocuments.slice(0, 2).map((document) => document.url ? (
                  <a key={`${document.title}-${document.url}`} href={document.url} target="_blank" rel="noreferrer">
                    {document.title}
                  </a>
                ) : (
                  <span key={document.title}>{document.title}</span>
                ))}
              </div>
            ) : null}
          </>
        ) : raceUpgradeError ? (
          <div className="race-weekend-empty">{t('carUpgradesLoadFailed')}: {raceUpgradeError.message}</div>
        ) : (
          <div className="race-weekend-empty">{t('noCarUpgrades')}</div>
        )}
      </Card>
    </div>
  );

  const shouldShowFastF1Section = activeWeekendMode === 'post';

  return (
    <div className="race-detail-page">
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(-1)}
        className="back-button"
      >
        {t('back')}
      </Button>

      <Card loading={seasonLoading || primaryLoading} className="race-info-card">
        <div className="race-hero">
          <div className="race-hero-top">
            <h1 className="race-hero-title">
              <FlagOutlined className="race-hero-flag" />
              <span>{raceInfo.raceName}</span>
            </h1>
            <div className="race-hero-badges">
              <span className="race-hero-date">
                <CalendarOutlined />
                {formatRaceDateTimeFull(raceInfo)}
              </span>
              {isSprintWeekend ? (
                <span className="race-hero-sprint">
                  {t('sprintWeekend')}
                </span>
              ) : null}
            </div>
          </div>
          <p className="race-hero-circuit">
            {raceInfo.Circuit.circuitName}
            <span> — {raceInfo.Circuit.Location.locality}, {raceInfo.Circuit.Location.country}</span>
          </p>
            {weekendScheduleGroups.length ? (
              <div className="weekend-schedule" aria-label={t('weekendSchedule')}>
                <div className="weekend-schedule-topbar">
                  <div>
                    <span className="weekend-schedule-eyebrow">{t('weekendSchedule')}</span>
                    <span className="weekend-schedule-source">{t('scheduleSourceHint')}</span>
                  </div>
                  <span className="weekend-time-toggle" aria-label={`${t('scheduleTimezone')} ${t('scheduleTimezoneValue')}`}>
                    <ClockCircleOutlined />
                    <strong>{t('scheduleTimezone')}</strong>
                    {t('scheduleTimezoneValue')}
                  </span>
                </div>
                <div className="weekend-schedule-days">
                  {weekendScheduleGroups.map((group) => (
                    <section key={group.key} className="weekend-schedule-day">
                      <div className="weekend-day-header">
                        <span className="weekend-day-name">{group.dayLabel}</span>
                        <span className="weekend-day-date">
                          <CalendarOutlined />
                          {group.dateLabel}
                        </span>
                      </div>
                      <div className="weekend-session-list">
                        {group.sessions.map((item) => (
                          <div key={item.key} className={`weekend-session weekend-session-${item.tone}`}>
                            <span className="weekend-session-code">{item.code}</span>
                            <span className="weekend-session-main">
                              <strong>{item.label}</strong>
                              <span>{t('scheduleTimezoneValue')}</span>
                            </span>
                            <time className="weekend-session-time">{item.timeLabel}</time>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            ) : null}
        </div>
      </Card>

      <section className="race-weekend-mode-section">
        <div className="race-weekend-mode-bar">
          <div>
            <span className="fastf1-eyebrow">{t('raceWeekendMode')}</span>
            <h2>{activeWeekendMode === 'pre' ? t('preRaceOverview') : t('postRaceOverview')}</h2>
          </div>
          <Segmented<RaceWeekendMode>
            value={activeWeekendMode}
            onChange={(value) => setSelectedWeekendMode(value)}
            options={[
              { label: t('preRace'), value: 'pre' },
              { label: t('postRace'), value: 'post' },
            ]}
          />
        </div>

        {racePreviewPanels}

        {activeWeekendMode === 'post' ? (
          <DataViewPanel
            title={t('telemetrySummary')}
            description={t('postRaceDescription')}
            className="race-weekend-post-card"
            mode={dataViewModes.telemetrySummary}
            collapsed={collapsedDataPanels.telemetrySummary}
            onModeChange={(mode) => handleDataViewModeChange('telemetrySummary', mode)}
            onToggleCollapse={() => handleDataPanelCollapseToggle('telemetrySummary')}
            chart={postRaceTelemetrySummary.length ? (
              <Suspense fallback={<div className="race-weekend-empty">{t('loading')}</div>}>
                <LazyEChartsPanel
                  chartKey={`post-race-telemetry-summary-${currentSeason}-${round}`}
                  height={isMobile ? 300 : 420}
                  option={telemetrySummaryChartOption}
                />
              </Suspense>
            ) : (
              <div className="race-weekend-empty">{t('noTelemetrySummary')}</div>
            )}
            table={(
              <>
                {postRaceTelemetrySummary.length ? (
                  <Table
                    columns={telemetrySummaryColumns}
                    dataSource={postRaceTelemetrySummary}
                    rowKey={(record) => record.driver}
                    pagination={false}
                    size="small"
                    scroll={{ x: 'max-content' }}
                  />
                ) : (
                  <div className="race-weekend-empty">{t('noTelemetrySummary')}</div>
                )}
              </>
            )}
          />
        ) : null}
      </section>

      {shouldShowFastF1Section ? (
        <section className="fastf1-analytics-section">
          <div className="fastf1-analytics-heading">
            <div>
              <span className="fastf1-eyebrow">{t('fastF1Source')}</span>
              <h2>{t('fastF1Analysis')}</h2>
            </div>
            {fastF1Analytics && fastF1Summary ? (
              <div className="fastf1-summary-strip" aria-label={t('fastF1Analysis')}>
                <span>{fastF1Summary.driverCount} {t('drivers')}</span>
                <span>{fastF1Summary.maxLap} {t('summaryLaps')}</span>
                <span>{fastF1Summary.stints} {t('stints')}</span>
                <span>{fastF1Summary.statusCount} {t('raceStatus')}</span>
                {fastF1Summary.weatherSummary ? (
                  <>
                    <span>{t('trackTemp')} {formatStatRange(fastF1Summary.weatherSummary.trackTempC)}</span>
                    <span>{t('airTemp')} {formatStatRange(fastF1Summary.weatherSummary.airTempC)}</span>
                    <span>{t('humidity')} {formatPercent(fastF1Summary.weatherSummary.humidityPct.average)}</span>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="fastf1-analysis-stack">
            {hasRaceAnalysisSection ? (
              <div className="fastf1-analysis-group fastf1-race-group">
                <div className="fastf1-analysis-group-header">
                  <div>
                    <span>{t('race')}</span>
                    <h3>{t('raceAnalysisGroup')}</h3>
                    <p>{t('lapPaceDescription')}</p>
                  </div>
                </div>
                <div className="fastf1-analytics-grid">
              {fastF1Analytics && lapPaceOption ? (
                <Card className="fastf1-chart-card">
                <div className="fastf1-chart-header">
                  <div>
                    <h3 className="fastf1-chart-title">{t('lapPace')}</h3>
                    <p>{t('lapPaceDescription')}</p>
                  </div>
                  <div className="fastf1-chart-badges">
                    {fastF1Analytics.fastestLap ? (
                      <span className="fastf1-fastest-lap-badge">
                        {t('fastestLap')}
                        {' '}
                        {fastF1Analytics.fastestLap.driver}
                        {' '}
                        L{fastF1Analytics.fastestLap.lapNumber}
                        {' '}
                        {formatSeconds(fastF1Analytics.fastestLap.lapTimeSeconds)}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="driver-legend" aria-label={t('driver')}>
                  {driverLegendItems.map((item) => {
                    const isActive = !hasLapDriverFilter || selectedLapDrivers.includes(item.driver);

                    return (
                      <button
                        key={item.driver}
                        type="button"
                        className={`driver-legend-item${isActive ? ' is-active' : ' is-muted'}`}
                        aria-pressed={selectedLapDrivers.includes(item.driver)}
                        onClick={() => handleLapDriverToggle(item.driver)}
                      >
                        <span
                          className="driver-legend-line"
                          style={{ backgroundColor: item.color }}
                        />
                        {item.driver}
                      </button>
                    );
                  })}
                </div>
                {fastF1Analytics.trackStatusPeriods?.length ? (
                  <div className="track-status-legend" aria-label={t('raceStatus')}>
                    {fastF1Analytics.trackStatusPeriods.map((period, index) => (
                      <span key={`${period.type}-${period.startLap}-${index}`}>
                        <span
                          className="track-status-swatch"
                          style={{ backgroundColor: TRACK_STATUS_STYLES[period.type].color }}
                        />
                        {period.label} L{period.startLap}-L{period.endLap}
                      </span>
                    ))}
                  </div>
                ) : null}
                <Suspense fallback={<div className="race-weekend-empty">{t('loading')}</div>}>
                  <LazyEChartsPanel
                    chartKey={`fastf1-laps-${currentSeason}-${round}`}
                    height={isMobile ? 300 : 430}
                    option={lapPaceOption}
                  />
                </Suspense>
              </Card>
              ) : null}

              {fastF1Analytics?.tyreStrategies.length ? (
              <Card className="fastf1-chart-card">
                <div className="fastf1-chart-header">
                  <div>
                    <h3 className="fastf1-chart-title">{t('tyreStrategy')}</h3>
                    <p>{t('tyreStrategyDescription')}</p>
                  </div>
                  {fastF1Summary ? (
                    <div className="compound-legend" aria-label={t('tyreStrategy')}>
                      {fastF1Summary.compounds.map((compound) => (
                        <span key={compound} className="compound-legend-item">
                          <span
                            className="compound-swatch"
                            style={{ backgroundColor: getCompoundColor(compound) }}
                          />
                          {formatCompoundWithCode(currentSeason, round, compound)}
                        </span>
                      ))}
                      <span className="compound-legend-item tyre-age-legend-item">
                        <span className="tyre-age-line is-new" />
                        {'\u65b0\u80ce'}
                      </span>
                      <span className="compound-legend-item tyre-age-legend-item">
                        <span className="tyre-age-line is-used" />
                        {'\u65e7\u80ce'}
                      </span>
                    </div>
                  ) : null}
                </div>
                <TyreStrategyTimeline
                  analytics={fastF1Analytics}
                  highlightedDrivers={selectedDuelDrivers}
                  season={currentSeason}
                  round={round}
                />
              </Card>
              ) : null}

              {fastF1Analytics ? (
              <Card className="fastf1-chart-card driver-duel-card">
                <div className="fastf1-chart-header">
                  <div>
                    <h3 className="fastf1-chart-title">{t('driverDuel')}</h3>
                    <p>{t('driverDuelDescription')}</p>
                  </div>
                  {duelTyreSummaryItems.length ? (
                    <div className="duel-summary-pills" aria-label={t('driverDuel')}>
                      {duelTyreSummaryItems.map((item) => (
                        <span key={item.driver} className="duel-stint-pill">
                          <strong>{item.driver}</strong>
                          {item.stints.map((stint) => (
                            <span key={`${item.driver}-${stint.stint}`} className="duel-stint-token">
                              <span
                                className="compound-swatch"
                                style={{ backgroundColor: getCompoundColor(stint.compound) }}
                              />
                              <strong>{formatCompoundWithCode(currentSeason, round, stint.compound)}</strong>
                              <em>{getTyreAgeLabel(stint)}</em>
                              {formatSessionSeconds(stint.averagePaceSeconds)}
                              {stint.previousDeltaSeconds !== null ? (
                                <em>{formatSignedSeconds(stint.previousDeltaSeconds)}</em>
                              ) : null}
                            </span>
                          ))}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="driver-legend" aria-label={t('driverDuel')}>
                  {duelDriverItems.map((item) => {
                    const isActive = selectedDuelDrivers.includes(item.driver);
                    const isMuted = selectedDuelDrivers.length === 2 && !isActive;

                    return (
                        <button
                          key={item.driver}
                          type="button"
                          className={`driver-legend-item${isActive ? ' is-active' : ''}${isMuted ? ' is-muted' : ''}`}
                          aria-pressed={isActive}
                          onClick={() => handleDuelDriverToggle(item.driver)}
                        >
                          <span
                            className="driver-legend-line"
                            style={{ backgroundColor: item.color }}
                          />
                          {item.driver}
                          {isActive ? (
                            <span className="duel-pick-badge">
                              {selectedDuelDrivers.indexOf(item.driver) + 1}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                </div>
                {activeDuelDrivers.length === 2 ? (
                  <>
                    <div className="duel-grid">
                      {duelSectorGapItems.length ? (
                        <div className="duel-sector-panel">
                          <div className="telemetry-panel-title">{t('qualifying')} Gap</div>
                          <div className="duel-sector-gap-grid">
                            {duelSectorGapItems.map((item) => (
                              <div
                                key={item.key}
                                className={`duel-sector-gap-card ${getGapToneClassName(item.value)}`}
                              >
                                <span>{item.label}</span>
                                <strong>{formatSignedSeconds(item.value)}</strong>
                                <em>{item.firstDriver} vs {item.secondDriver}</em>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {duelCornerRows.length ? (
                        <div className="duel-corner-panel">
                          <div className="telemetry-panel-title">{t('cornerSpeed')}</div>
                          <div className="duel-corner-grid">
                            {duelCornerRows.map((row) => (
                              <div key={row.key} className="duel-corner-card">
                                <div className="duel-corner-head">
                                  <span>{row.corner}</span>
                                  <em>{formatNumber(row.distanceM, 0)}m</em>
                                </div>
                                <div className="duel-corner-row">
                                  <strong>{row.driverA}</strong>
                                  <span>{formatSpeed(row.firstMinSpeed)}</span>
                                </div>
                                <div className="duel-corner-row">
                                  <strong>{row.driverB}</strong>
                                  <span>{formatSpeed(row.secondMinSpeed)}</span>
                                </div>
                                <div className="duel-corner-row is-delta">
                                  <strong>{t('delta')}</strong>
                                  <span>{formatSignedNumber(row.delta, 1)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <div className="duel-empty-state">
                    {t('driverDuel')}: {t('driver')} 2
                  </div>
                )}
              </Card>
              ) : null}

              {fastF1Analytics && weatherOption && fastF1Analytics.weather ? (
                <Card className="fastf1-chart-card">
                  <div className="fastf1-chart-header">
                    <div>
                      <h3 className="fastf1-chart-title">{t('weatherTrend')}</h3>
                      <p>{t('weatherDescription')}</p>
                    </div>
                    <div className="weather-summary-pills" aria-label={t('weatherTrend')}>
                      <span>{t('trackTemp')} {formatStatRange(fastF1Analytics.weather.summary.trackTempC)}</span>
                      <span>{t('airTemp')} {formatStatRange(fastF1Analytics.weather.summary.airTempC)}</span>
                      <span>{t('wind')} {formatWindSpeed(fastF1Analytics.weather.summary.maxWindSpeedMps)}</span>
                    </div>
                  </div>
                  {fastF1Analytics.weather.summary.rainLapRanges.length ? (
                    <div className="weather-rain-legend" aria-label={t('rainfall')}>
                      <span className="weather-rain-swatch" />
                      <span>{t('rainfall')} {formatLapRanges(fastF1Analytics.weather.summary.rainLapRanges)}</span>
                    </div>
                  ) : null}
                  <Suspense fallback={<div className="race-weekend-empty">{t('loading')}</div>}>
                    <LazyEChartsPanel
                      chartKey={`fastf1-weather-${currentSeason}-${round}`}
                      height={isMobile ? 300 : 360}
                      option={weatherOption}
                    />
                  </Suspense>
                </Card>
              ) : null}

              {fastF1Analytics?.telemetry ? (
                <Card className="fastf1-chart-card telemetry-card">
                  <div className="fastf1-chart-header">
                    <div>
                      <h3 className="fastf1-chart-title">{t('telemetryComparison')}</h3>
                      <p>{t('telemetryDescription')}</p>
                    </div>
                  </div>
                  <div className="telemetry-driver-strip" aria-label={t('telemetryComparison')}>
                    {telemetryDriverItems.map((item) => {
                      const isActive = selectedTelemetryDrivers.includes(item.driver);
                      const isMuted = selectedTelemetryDrivers.length > 0 && !isActive;

                      return (
                        <button
                          key={item.driver}
                          type="button"
                          className={`driver-legend-item${isActive ? ' is-active' : ''}${isMuted ? ' is-muted' : ''}`}
                          aria-pressed={selectedTelemetryDrivers.includes(item.driver)}
                          onClick={() => handleTelemetryDriverToggle(item.driver)}
                        >
                          <span
                            className="driver-legend-line"
                            style={{ backgroundColor: item.color }}
                          />
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                  {telemetrySpeedOption ? (
                    <Suspense fallback={<div className="race-weekend-empty">{t('loading')}</div>}>
                      <LazyEChartsPanel
                        chartKey={`fastf1-telemetry-speed-${currentSeason}-${round}-${activeTelemetryDrivers.map((driver) => driver.driver).join('-')}`}
                        height={isMobile ? 280 : 330}
                        option={telemetrySpeedOption}
                      />
                    </Suspense>
                  ) : null}
                  {telemetryHeatmapOption ? (
                    <div className="telemetry-heatmap-panel">
                      <div className="telemetry-panel-title">{t('speedHeatmap')}</div>
                      <Suspense fallback={<div className="race-weekend-empty">{t('loading')}</div>}>
                        <LazyEChartsPanel
                          chartKey={`fastf1-telemetry-heatmap-${currentSeason}-${round}-${activeTelemetryDrivers.map((driver) => driver.driver).join('-')}`}
                          height={isMobile ? 280 : 360}
                          option={telemetryHeatmapOption}
                        />
                      </Suspense>
                      <div className="telemetry-heat-legend" aria-label={t('speedHeatmap')}>
                        <span className="telemetry-heat-low" /> {t('minimum')}
                        <span className="telemetry-heat-high" /> {t('speed')}
                      </div>
                    </div>
                  ) : null}
                  {telemetryControlOption ? (
                    <>
                      <div className="telemetry-chart-divider" />
                      <div className="telemetry-metric-strip" aria-label={t('telemetryComparison')}>
                        {TELEMETRY_METRICS.map((metric) => {
                          const isActive = selectedTelemetryMetrics.includes(metric.key);

                          return (
                            <button
                              key={metric.key}
                              type="button"
                              className={`telemetry-metric-button${isActive ? ' is-active' : ' is-muted'}`}
                              aria-pressed={isActive}
                              onClick={() => handleTelemetryMetricToggle(metric.key)}
                            >
                              {metric.label}
                            </button>
                          );
                        })}
                      </div>
                      <Suspense fallback={<div className="race-weekend-empty">{t('loading')}</div>}>
                        <LazyEChartsPanel
                          chartKey={`fastf1-telemetry-controls-${currentSeason}-${round}-${activeTelemetryDrivers.map((driver) => driver.driver).join('-')}-${selectedTelemetryMetrics.join('-')}`}
                          height={isMobile ? 300 : 340}
                          option={telemetryControlOption}
                        />
                      </Suspense>
                    </>
                  ) : null}
                  {telemetryCornerRows.length ? (
                    <div className="telemetry-corner-table">
                      <div className="telemetry-panel-title">{t('cornerSpeed')}</div>
                      <Table
                        columns={telemetryCornerColumns}
                        dataSource={telemetryCornerRows}
                        pagination={false}
                        size="small"
                        scroll={{ x: 'max-content' }}
                      />
                    </div>
                  ) : null}
                </Card>
              ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <Card
        className="results-card race-weekend-card data-view-card"
        title={<div className="data-view-title"><span>{t('result')}</span></div>}
        extra={(
          <div className="data-view-actions">
            <Button type="text" size="small" onClick={() => handleDataPanelCollapseToggle('raceResults')}>
              {collapsedDataPanels.raceResults ? t('expand') : t('collapse')}
            </Button>
          </div>
        )}
      >
        {collapsedDataPanels.raceResults ? null : isMobile ? (
          <div className="mobile-slider-container">
            <div className="slider-header">
              <Button
                icon={<LeftOutlined />}
                onClick={handlePrevTab}
                disabled={currentTabIndex <= 0}
                className="nav-button"
              />
              <div className="tab-indicators">
                {tabItems.map((item, index) => (
                  <span
                    key={item.key}
                    className={`tab-dot ${index === currentTabIndex ? 'active' : ''}`}
                    onClick={() => setActiveTab(item.key)}
                  />
                ))}
              </div>
              <Button
                icon={<RightOutlined />}
                onClick={handleNextTab}
                disabled={currentTabIndex === tabItems.length - 1}
                className="nav-button"
              />
            </div>
            <div className="current-tab-label">{currentItem?.label}</div>
            <div className="slider-content">
              <Table
                columns={currentItem?.columns}
                dataSource={currentItem?.data}
                rowKey={(record: any) => record.Driver?.driverId || record.driver || ''}
                pagination={false}
                loading={currentItem ? getTableLoading(currentItem.key, currentItem.data) : false}
                scroll={{ x: 'max-content' }}
                size="small"
              />
            </div>
            <div className="swipe-hint">{t('mobileHint')}</div>
          </div>
        ) : (
          <Tabs
            activeKey={effectiveActiveTab}
            onChange={setActiveTab}
            items={tabItems.map((item) => ({
              key: item.key,
              label: item.label,
              children: (
                <Table
                  columns={item.columns}
                  dataSource={item.data}
                  rowKey={(record: any) => record.Driver?.driverId || record.driver || ''}
                  pagination={false}
                  loading={getTableLoading(item.key, item.data)}
                />
              ),
            }))}
          />
        )}
      </Card>
    </div>
  );
};

export default RaceDetail;
