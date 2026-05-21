import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  Constructor,
  Driver,
  FastF1DriverLapSeries,
  FastF1CornerAnalysis,
  FastF1QualifyingBestLap,
  FastF1RaceAnalytics,
  FastF1SessionResult,
  FastF1StrategyStint,
  FastF1TelemetryDriver,
  FastF1TelemetrySample,
  FastF1TrackStatusPeriod,
  FastF1WeatherLapRange,
  FastF1WeatherPoint,
  Race,
  RaceWeekendMode,
  RecentGrandPrixResult,
  QualifyingResult,
  Result,
  TrackInterruptionProbability,
  TrackInterruptionSample,
  DriverPostRaceTelemetrySummary,
} from '@/types';
import type { FiaUpgradeReason } from '@/utils/fiaCarUpgrades';
import { getSupabaseCircuitId } from '@/utils/circuitIds';
import { formatRaceDateTimeFull, getRaceWeekendSchedule, getRaceWeekendScheduleGroups } from '@/utils/raceSchedule';
import {
  escapeTooltipText,
  formatNumber,
  formatPodium,
  formatPercent,
  formatProbability,
  formatRpm,
  formatSeconds,
  formatShortDate,
  formatSignedNumber,
  formatSignedSeconds,
  formatSpeed,
  formatTemperature,
  formatWindSpeed,
  getGapToneClassName,
} from '@/utils/raceDetailFormatters';
import { formatCompoundWithCode, formatTyreLife, getTyreAgeLabel } from '@/utils/tyreCompounds';
import './RaceDetail.css';

interface RaceTabItem {
  key: string;
  label: string;
  data: Array<Result | QualifyingResult>;
  columns: ColumnsType<Result | QualifyingResult>;
}

type TelemetryMetric = 'throttle' | 'brake' | 'gear' | 'rpm';
type DataViewMode = 'chart' | 'table';
type DataPanelKey = 'telemetrySummary';
type CollapsiblePanelKey = DataPanelKey | 'recentResults' | 'interruptionRisk' | 'raceResults';
type ChartTooltipParam = {
  seriesName?: string;
  name?: string;
  color?: string;
  value?: number[];
  data?: Record<string, unknown>;
};
type ChartTooltipInput = ChartTooltipParam | ChartTooltipParam[];
type ChartTooltipParamWithValue = ChartTooltipParam & { value: number[] };

function hasNumericTooltipValue(param: ChartTooltipParam): param is ChartTooltipParamWithValue {
  return Number.isFinite(param.value?.[1]);
}

const DEFERRED_TAB_KEYS = ['fp1', 'fp2', 'fp3', 'sprintQualifying', 'sprint'];
const LazyEChartsPanel = lazy(() => import('@/components/charts/EChartsPanel'));

const TEXT = {
  loading: '\u52a0\u8f7d\u4e2d...',
  back: '\u8fd4\u56de\u8d5b\u4e8b',
  notFound: '\u672a\u627e\u5230\u8be5\u573a\u6bd4\u8d5b\u4fe1\u606f\u3002',
  rank: '\u6392\u540d',
  driver: '\u8f66\u624b',
  constructor: '\u8f66\u961f',
  grid: '\u53d1\u8f66',
  laps: '\u5708\u6570',
  result: '\u6210\u7ee9',
  fastestLap: '\u6700\u5feb\u5708',
  points: '\u79ef\u5206',
  sprintWeekend: '\u51b2\u523a\u5468\u672b',
  weekendSchedule: '\u5468\u672b\u65f6\u95f4\u8868',
  scheduleTimezone: '\u6211\u7684\u65f6\u95f4',
  scheduleTimezoneValue: '\u5317\u4eac\u65f6\u95f4',
  scheduleSourceHint: '\u6309\u5b98\u65b9\u8d5b\u7a0b\u7ed3\u6784\u5c55\u793a',
  mobileHint: '\u70b9\u51fb\u4e0a\u65b9\u5706\u70b9\u5207\u6362\u4f1a\u8bdd',
  season: '\u8d5b\u5b63',
  fp1: '\u7ec3\u4e60\u8d5b 1',
  fp2: '\u7ec3\u4e60\u8d5b 2',
  fp3: '\u7ec3\u4e60\u8d5b 3',
  qualifying: '\u6392\u4f4d\u8d5b',
  sprintQualifying: '\u51b2\u523a\u6392\u4f4d\u8d5b',
  sprint: '\u51b2\u523a\u8d5b',
  race: '\u6b63\u8d5b',
  fastF1Analysis: 'FastF1 \u6bd4\u8d5b\u5206\u6790',
  raceAnalysisGroup: '\u6b63\u8d5b\u5206\u6790',
  lapPace: '\u5708\u901f\u8d70\u52bf',
  tyreStrategy: '\u8f6e\u80ce\u7b56\u7565',
  qualifyingAnalyzer: '\u6392\u4f4d\u5206\u6790',
  driverDuel: '\u8f66\u624b\u5bf9\u6218',
  strategyTimeline: '\u7b56\u7565\u4e0e\u8d5b\u4e8b\u65f6\u95f4\u8f74',
  weatherTrend: '\u5929\u6c14\u8d70\u52bf',
  telemetryComparison: '\u6700\u5feb\u5708\u9065\u6d4b',
  telemetryDescription: '\u5bf9\u6bd4\u4e24\u4f4d\u8f66\u624b\u6700\u5feb\u5708\u7684\u901f\u5ea6\u3001\u6cb9\u95e8\u3001\u5239\u8f66\u3001\u6863\u4f4d\u548c RPM\uff0c\u5e76\u6309\u5f2f\u89d2\u6c47\u603b\u5165\u5f2f\u3001\u6700\u4f4e\u548c\u51fa\u5f2f\u901f\u5ea6\u3002',
  speedHeatmap: '\u8d5b\u9053\u901f\u5ea6\u70ed\u529b\u56fe',
  fastF1Source: '\u79bb\u7ebf\u6570\u636e',
  drivers: '\u8f66\u624b',
  summaryLaps: '\u5708',
  stints: '\u6bb5\u8f6e\u80ce',
  lapPaceDescription: '\u9010\u5708\u5bf9\u6bd4\u6b63\u8d5b\u8282\u594f\uff0c\u53ef\u5feb\u901f\u770b\u5230\u957f\u8ddd\u79bb\u901f\u5ea6\u8870\u51cf\u548c\u5b89\u5168\u8f66\u5f71\u54cd\u3002',
  tyreStrategyDescription: '\u6309\u8f66\u624b\u62c6\u5206 stint \u548c compound\uff0c\u5c55\u793a\u6bcf\u6bb5\u8f6e\u80ce\u7684\u5708\u6570\u548c\u6362\u80ce\u8282\u70b9\u3002',
  driverDuelDescription: '\u9009\u62e9\u4e24\u4f4d\u8f66\u624b\uff0c\u5bf9\u6bd4\u6392\u4f4d sector\u3001\u6b63\u8d5b stint pace\u3001\u8f6e\u80ce\u8870\u51cf\u3001\u9065\u6d4b\u548c\u5f2f\u89d2\u6700\u4f4e\u901f\u3002',
  strategyTimelineDescription: '\u5c06\u8fdb\u7ad9\u3001\u6362\u80ce\u3001\u8d5b\u9053\u72b6\u6001\u3001Race Control \u548c\u964d\u96e8\u4e32\u5230\u540c\u4e00\u6761\u5708\u6570\u8f74\u4e0a\uff0c\u5e2e\u52a9\u89e3\u91ca\u7b56\u7565\u6536\u76ca\u548c\u8282\u594f\u53d8\u5316\u3002',
  weatherDescription: '\u5c06\u8d5b\u9053\u6e29\u5ea6\u3001\u6c14\u6e29\u3001\u6e7f\u5ea6\u548c\u964d\u96e8\u6620\u5c04\u5230\u5708\u6570\uff0c\u7528\u4e8e\u89e3\u91ca\u5708\u901f\u548c\u8f6e\u80ce\u8868\u73b0\u53d8\u5316\u3002',
  raceStatus: '\u8d5b\u9053\u72b6\u6001',
  raceWeekendMode: '\u8d5b\u5468\u6a21\u5f0f',
  noFastF1Analysis: '\u6682\u672a\u8bfb\u53d6\u5230 FastF1 \u6b63\u8d5b\u5206\u6790\uff0c\u5df2\u4fdd\u7559 Jolpica \u7ed3\u679c\u548c\u8d5b\u9053\u57fa\u7840\u6570\u636e\u3002',
  preRace: '\u8d5b\u524d',
  postRace: '\u8d5b\u540e',
  preRaceOverview: '\u8d5b\u524d\u60c5\u62a5',
  preRaceDescription: '\u805a\u5408\u672c\u7ad9\u8fd1\u4e94\u6b21\u529e\u8d5b\u7684\u51a0\u519b\u3001\u6746\u4f4d\u3001\u9886\u5956\u53f0\u548c\u8d5b\u9053\u72b6\u6001\u98ce\u9669\u3002',
  recentWinners: '\u8fd1\u4e94\u6b21\u51a0\u519b',
  interruptionRisk: '\u8d5b\u9053\u4e2d\u65ad\u6982\u7387',
  poleConversion: '\u6746\u4f4d\u8f6c\u5316',
  historicalRaces: '\u5386\u53f2\u573a\u6b21',
  lapTime: '\u5708\u901f',
  raceControlMessages: 'Race Control',
  postRaceOverview: '\u8d5b\u540e\u603b\u7ed3',
  postRaceDescription: '\u6309\u8f66\u624b\u6c47\u603b\u6700\u5feb\u5708\u9065\u6d4b\u4e2d\u7684\u5c3e\u901f\u3001\u6cb9\u95e8\u3001\u5239\u8f66\u548c DRS \u8868\u73b0\u3002',
  telemetrySummary: '\u9065\u6d4b\u6458\u8981',
  winner: '\u51a0\u519b',
  pole: '\u6746\u4f4d',
  podium: '\u9886\u5956\u53f0',
  sampleSize: '\u6837\u672c',
  sampleYears: '\u6837\u672c\u5e74\u4efd',
  insufficientData: '\u6570\u636e\u4e0d\u8db3',
  noInterruption: '\u65e0\u8bb0\u5f55',
  probability: '\u6982\u7387',
  maxSpeed: '\u6700\u9ad8\u5c3e\u901f',
  averageSpeed: '\u5e73\u5747\u901f\u5ea6',
  fullThrottle: '\u5168\u6cb9\u95e8',
  averageThrottle: '\u5e73\u5747\u6cb9\u95e8',
  drs: 'DRS',
  noPreviewData: '\u6682\u65e0\u672c\u7ad9\u5386\u53f2\u805a\u5408\u6570\u636e',
  noTelemetrySummary: '\u6682\u65e0\u8d5b\u540e\u9065\u6d4b\u6458\u8981',
  chart: '\u7edf\u8ba1\u56fe',
  table: '\u8868\u683c',
  collapse: '\u6536\u8d77',
  expand: '\u5c55\u5f00',
  trackTemp: '\u8d5b\u9053\u6e29\u5ea6',
  airTemp: '\u6c14\u6e29',
  humidity: '\u6e7f\u5ea6',
  rainfall: '\u964d\u96e8',
  wind: '\u98ce\u901f',
  sector1: 'S1',
  sector2: 'S2',
  sector3: 'S3',
  speed: '\u901f\u5ea6',
  throttle: '\u6cb9\u95e8',
  brake: '\u5239\u8f66',
  gear: '\u6863\u4f4d',
  rpm: 'RPM',
  corner: '\u5f2f\u89d2',
  cornerSpeed: '\u5f2f\u89d2\u901f\u5ea6',
  entry: '\u5165\u5f2f',
  minimum: '\u6700\u4f4e',
  exit: '\u51fa\u5f2f',
  delta: '\u5dee\u503c',
  cutoff: '\u664b\u7ea7\u7ebf',
  lastFlyer: '\u6700\u540e\u4e00\u98de',
  deletedLap: 'Deleted Lap',
  teamMateDelta: '\u961f\u53cb\u5dee\u8ddd',
  phase: '\u9636\u6bb5',
  lap: '\u5708',
  time: '\u65f6\u95f4',
  reason: '\u539f\u56e0',
  pitStops: '\u8fdb\u7ad9',
  pitLap: '\u8fdb\u7ad9\u5708',
  tyre: '\u8f6e\u80ce',
  tyreAge: '\u65b0\u65e7',
  tyreLife: '\u80ce\u9f84',
  pitTime: '\u8fdb\u7ad9\u65f6\u95f4',
  paceBefore: '\u8fdb\u7ad9\u524d\u8282\u594f',
  paceAfter: '\u8fdb\u7ad9\u540e\u8282\u594f',
  positionDelta: '\u4f4d\u7f6e\u53d8\u5316',
  context: '\u80cc\u666f',
  strategyBattle: '\u7b56\u7565\u5bf9\u6297',
  bestPaceGain: '\u6700\u5927\u8282\u594f\u63d0\u5347',
  stintPace: 'Stint Pace',
  degradation: '\u8870\u51cf',
  advantage: '\u4f18\u52bf',
  carUpgrades: '\u5206\u7ad9\u5347\u7ea7\u60c5\u51b5',
  carUpgradesDescription: '\u6309\u8f66\u961f\u6c47\u603b\u672c\u7ad9 FIA \u8f66\u4f53\u5347\u7ea7\u7533\u62a5\uff0c\u91cd\u70b9\u770b\u6570\u91cf\u3001\u5f3a\u5ea6\u548c\u4e3b\u8981\u610f\u56fe\u3002',
  noCarUpgrades: '\u6682\u65e0\u672c\u7ad9 FIA \u5347\u7ea7\u7533\u62a5\u6570\u636e',
  carUpgradesLoadFailed: '\u5347\u7ea7\u6570\u636e\u8bfb\u53d6\u5931\u8d25',
  upgradeTotal: '\u603b\u5347\u7ea7\u6570',
  upgradeIntensity: '\u5347\u7ea7\u5f3a\u5ea6',
  upgradeTeams: '\u7533\u62a5\u8f66\u961f',
  upgradeIntent: '\u4e3b\u8981\u610f\u56fe',
  upgradeComponents: '\u91cd\u70b9\u90e8\u4ef6',
  upgradeSource: '\u6765\u6e90',
  performance: '\u6027\u80fd',
  circuitSpecific: '\u8d5b\u9053\u9002\u914d',
  reliability: '\u53ef\u9760\u6027',
  cooling: '\u51b7\u5374',
  other: '\u5176\u4ed6',
  unknown: '\u672a\u77e5',
};

const UPGRADE_REASON_LABELS: Record<FiaUpgradeReason, string> = {
  Performance: TEXT.performance,
  'Circuit specific': TEXT.circuitSpecific,
  Reliability: TEXT.reliability,
  Cooling: TEXT.cooling,
  Other: TEXT.other,
  Unknown: TEXT.unknown,
};

const TELEMETRY_METRICS: Array<{ key: TelemetryMetric; label: string }> = [
  { key: 'throttle', label: TEXT.throttle },
  { key: 'brake', label: TEXT.brake },
  { key: 'gear', label: TEXT.gear },
  { key: 'rpm', label: TEXT.rpm },
];

const COMPOUND_COLORS: Record<string, string> = {
  SOFT: '#ef4444',
  MEDIUM: '#f5c542',
  HARD: '#f4f4f5',
  INTERMEDIATE: '#22c55e',
  WET: '#38bdf8',
  UNKNOWN: '#94a3b8',
};

const DRIVER_COLORS = [
  '#ff1801',
  '#2563eb',
  '#16a34a',
  '#f97316',
  '#7c3aed',
  '#0891b2',
  '#db2777',
  '#65a30d',
  '#475569',
  '#dc2626',
  '#0284c7',
  '#9333ea',
  '#ca8a04',
  '#0f766e',
  '#be123c',
  '#4f46e5',
  '#15803d',
  '#ea580c',
  '#64748b',
  '#a855f7',
];

const WEATHER_COLORS = {
  trackTemp: '#ef4444',
  airTemp: '#f97316',
  humidity: '#2563eb',
  rain: 'rgba(14, 165, 233, 0.16)',
  rainBorder: 'rgba(2, 132, 199, 0.32)',
};

const TRACK_STATUS_STYLES: Record<
  FastF1TrackStatusPeriod['type'],
  { color: string; borderColor: string }
> = {
  YELLOW: {
    color: 'rgba(245, 197, 66, 0.18)',
    borderColor: 'rgba(202, 138, 4, 0.42)',
  },
  VSC: {
    color: 'rgba(249, 115, 22, 0.16)',
    borderColor: 'rgba(234, 88, 12, 0.4)',
  },
  SC: {
    color: 'rgba(59, 130, 246, 0.14)',
    borderColor: 'rgba(37, 99, 235, 0.38)',
  },
  RED: {
    color: 'rgba(239, 68, 68, 0.16)',
    borderColor: 'rgba(220, 38, 38, 0.4)',
  },
};

const CHART_TOOLTIP_CSS = [
  'max-width: min(520px, calc(100vw - 32px))',
  'max-height: min(70vh, 520px)',
  'overflow-y: auto',
  'box-shadow: 0 18px 45px rgba(15, 23, 42, 0.22)',
  'border-radius: 10px',
  'padding: 10px 12px',
].join(';');

function formatStatRange(summary?: { min: number | null; max: number | null }) {
  if (!summary || summary.min === null || summary.max === null) {
    return '-';
  }

  return `${formatNumber(summary.min, 1)}-${formatNumber(summary.max, 1)} C`;
}

function formatSessionSeconds(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '-';
  }

  return formatSeconds(value);
}

interface RankingChartRow {
  label: string;
  value: number;
  color?: string;
  displayValue?: string;
}

function buildRankingBarOption(
  title: string,
  yAxisName: string,
  rows: RankingChartRow[],
  formatter: (value: number) => string = (value) => String(value),
) {
  const values = rows.map((row) => row.value).filter((value) => Number.isFinite(value));
  const minValue = values.length ? Math.min(...values) : 0;
  const maxValue = values.length ? Math.max(...values) : 0;
  const range = Math.max(maxValue - minValue, maxValue * 0.08, 1);
  const yMin = Math.max(0, Math.floor(minValue - range * 0.28));

  return {
    backgroundColor: '#050505',
    color: rows.map((row, index) => row.color || DRIVER_COLORS[index % DRIVER_COLORS.length]),
    title: {
      text: title,
      left: 'center',
      top: 12,
      textStyle: {
        color: '#f8fafc',
        fontSize: 24,
        fontWeight: 500,
      },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      appendToBody: true,
      borderWidth: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.94)',
      extraCssText: CHART_TOOLTIP_CSS,
      textStyle: { color: '#fff' },
      formatter: (params: ChartTooltipInput) => {
        const item = Array.isArray(params) ? params[0] : params;
        const row = rows.find((entry) => entry.label === item?.name);

        return `
          <div class="fastf1-tooltip-row">
            <span class="fastf1-tooltip-marker" style="background:${item?.color || '#fff'};"></span>
            <span class="fastf1-tooltip-name">${escapeTooltipText(item?.name || '')}</span>
            <strong>${row?.displayValue || formatter(Number(item?.value || 0))}</strong>
          </div>
        `;
      },
    },
    grid: {
      top: 86,
      right: 26,
      bottom: 58,
      left: 72,
    },
    xAxis: {
      type: 'category',
      data: rows.map((row) => row.label),
      axisLine: { lineStyle: { color: '#3f3f46', width: 2 } },
      axisTick: { lineStyle: { color: '#d4d4d8' } },
      axisLabel: {
        color: '#f4f4f5',
        fontSize: 13,
        fontWeight: 700,
        rotate: rows.length > 8 ? 18 : 0,
      },
    },
    yAxis: {
      type: 'value',
      name: yAxisName,
      min: yMin,
      nameLocation: 'middle',
      nameGap: 48,
      nameTextStyle: {
        color: '#f4f4f5',
        fontSize: 15,
        fontWeight: 700,
      },
      axisLine: { show: true, lineStyle: { color: '#3f3f46', width: 2 } },
      axisLabel: {
        color: '#f4f4f5',
        fontSize: 15,
        fontWeight: 700,
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(244, 244, 245, 0.18)',
          type: 'dashed',
        },
      },
      minorSplitLine: {
        show: true,
        lineStyle: {
          color: 'rgba(244, 244, 245, 0.1)',
          type: 'dashed',
        },
      },
    },
    series: [{
      name: yAxisName,
      type: 'bar',
      barMaxWidth: 42,
      itemStyle: {
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
      },
      label: {
        show: true,
        position: 'top',
        color: '#f8fafc',
        fontSize: rows.length > 12 ? 12 : 15,
        fontWeight: 700,
        formatter: (param: { dataIndex: number; value: number }) =>
          rows[param.dataIndex]?.displayValue || formatter(Number(param.value || 0)),
      },
      labelLayout: {
        hideOverlap: true,
      },
      data: rows.map((row, index) => ({
        value: row.value,
        itemStyle: {
          color: row.color || DRIVER_COLORS[index % DRIVER_COLORS.length],
        },
      })),
    }],
  };
}

function getTelemetrySummaryChartRows(items: DriverPostRaceTelemetrySummary[]): RankingChartRow[] {
  return [...items]
    .filter((item) => item.maxSpeedKph !== null && item.maxSpeedKph !== undefined)
    .sort((a, b) => (b.maxSpeedKph || 0) - (a.maxSpeedKph || 0))
    .map((item, index) => ({
      label: item.driver,
      value: item.maxSpeedKph || 0,
      displayValue: formatNumber(item.maxSpeedKph || 0, 0),
      color: DRIVER_COLORS[index % DRIVER_COLORS.length],
    }));
}

interface DataViewPanelProps {
  title: string;
  description?: string;
  className?: string;
  loading?: boolean;
  mode: DataViewMode;
  collapsed: boolean;
  onModeChange: (mode: DataViewMode) => void;
  onToggleCollapse: () => void;
  chart: JSX.Element;
  table: JSX.Element;
}

function DataViewPanel({
  title,
  description,
  className = '',
  loading = false,
  mode,
  collapsed,
  onModeChange,
  onToggleCollapse,
  chart,
  table,
}: DataViewPanelProps) {
  return (
    <Card
      className={`race-weekend-card data-view-card ${className}`}
      loading={loading}
      title={(
        <div className="data-view-title">
          <span>{title}</span>
          {description ? <small>{description}</small> : null}
        </div>
      )}
      extra={(
        <div className="data-view-actions">
          <Segmented<DataViewMode>
            value={mode}
            onChange={onModeChange}
            disabled={collapsed}
            size="small"
            options={[
              { label: TEXT.chart, value: 'chart' },
              { label: TEXT.table, value: 'table' },
            ]}
          />
          <Button type="text" size="small" onClick={onToggleCollapse}>
            {collapsed ? TEXT.expand : TEXT.collapse}
          </Button>
        </div>
      )}
    >
      {collapsed ? null : mode === 'chart' ? chart : table}
    </Card>
  );
}

interface TableOnlyPanelProps {
  title: string;
  description?: string;
  className?: string;
  loading?: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  children: JSX.Element;
}

function TableOnlyPanel({
  title,
  description,
  className = '',
  loading = false,
  collapsed,
  onToggleCollapse,
  children,
}: TableOnlyPanelProps) {
  return (
    <Card
      className={`race-weekend-card data-view-card ${className}`}
      loading={loading}
      title={(
        <div className="data-view-title">
          <span>{title}</span>
          {description ? <small>{description}</small> : null}
        </div>
      )}
      extra={(
        <Button type="text" size="small" onClick={onToggleCollapse}>
          {collapsed ? TEXT.expand : TEXT.collapse}
        </Button>
      )}
    >
      {collapsed ? null : children}
    </Card>
  );
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

function getCompoundColor(compound: string) {
  return COMPOUND_COLORS[compound.toUpperCase()] || COMPOUND_COLORS.UNKNOWN;
}

function getDriverColor(index: number) {
  return DRIVER_COLORS[index % DRIVER_COLORS.length];
}

function getMaxRaceLap(analytics: FastF1RaceAnalytics) {
  if (analytics.totalLaps) {
    return analytics.totalLaps;
  }

  return Math.max(
    0,
    ...analytics.lapTimeSeries.flatMap((series) =>
      series.laps.map((lap) => lap.lapNumber),
    ),
    ...analytics.tyreStrategies.flatMap((strategy) =>
      strategy.stints.map((stint) => stint.endLap),
    ),
  );
}

function buildLapPaceTooltip(params: ChartTooltipInput) {
  const tooltipItems = (Array.isArray(params) ? params : [params])
    .filter(hasNumericTooltipValue)
    .sort((a, b) => a.value[1] - b.value[1]);

  if (!tooltipItems.length) {
    return '';
  }

  const lapNumber = tooltipItems[0]?.value?.[0] ?? '-';
  const rows = tooltipItems.map((param) => `
    <div class="fastf1-tooltip-row">
        <span class="fastf1-tooltip-marker" style="background:${param.color};"></span>
        <span class="fastf1-tooltip-name">${escapeTooltipText(param.seriesName)}</span>
        <strong>${formatSeconds(param.value[1])}</strong>
    </div>
  `).join('');

  return `
    <div class="fastf1-tooltip">
      <div class="fastf1-tooltip-title">Lap ${escapeTooltipText(lapNumber)}</div>
      <div class="fastf1-tooltip-grid">${rows}</div>
    </div>
  `;
}

function buildTrackStatusMarkArea(periods: FastF1TrackStatusPeriod[] = []) {
  if (!periods.length) {
    return undefined;
  }

  return {
    silent: true,
    label: {
      show: false,
    },
    data: periods.map((period) => {
      const style = TRACK_STATUS_STYLES[period.type];
      return [
        {
          name: period.label,
          xAxis: period.startLap,
          itemStyle: {
            color: style.color,
            borderColor: style.borderColor,
            borderWidth: 1,
          },
        },
        {
          xAxis: Math.max(period.startLap, period.endLap),
        },
      ];
    }),
  };
}

function buildLapPaceOption(
  analytics: FastF1RaceAnalytics,
  selectedDrivers: string[],
) {
  const fastestLap = analytics.fastestLap;
  const statusMarkArea = buildTrackStatusMarkArea(analytics.trackStatusPeriods);
  const visibleDriverSet = selectedDrivers.length ? new Set(selectedDrivers) : null;
  const visibleSeries = analytics.lapTimeSeries
    .map((series, index) => ({
      series,
      color: getDriverColor(index),
    }))
    .filter((item) => !visibleDriverSet || visibleDriverSet.has(item.series.driver));

  return {
    backgroundColor: 'transparent',
    color: DRIVER_COLORS,
    tooltip: {
      trigger: 'axis',
      appendToBody: true,
      borderWidth: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.92)',
      extraCssText: CHART_TOOLTIP_CSS,
      textStyle: {
        color: '#fff',
      },
      formatter: buildLapPaceTooltip,
      valueFormatter: (value: number) => formatSeconds(value),
    },
    axisPointer: {
      link: [{ xAxisIndex: 'all' }],
      label: {
        backgroundColor: '#111827',
      },
      lineStyle: {
        color: '#94a3b8',
        type: 'dashed',
      },
    },
    legend: {
      show: false,
    },
    grid: {
      top: 18,
      right: 24,
      bottom: 44,
      left: 68,
    },
    xAxis: {
      type: 'value',
      name: 'Lap',
      max: getMaxRaceLap(analytics),
      minInterval: 1,
      axisLine: {
        lineStyle: { color: '#cbd5e1' },
      },
      axisTick: {
        lineStyle: { color: '#cbd5e1' },
      },
      axisLabel: {
        color: '#64748b',
      },
      splitLine: {
        lineStyle: { color: 'rgba(148, 163, 184, 0.18)' },
      },
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLabel: {
        formatter: (value: number) => formatSeconds(value),
        color: '#64748b',
      },
      axisLine: {
        lineStyle: { color: '#cbd5e1' },
      },
      splitLine: {
        lineStyle: { color: 'rgba(148, 163, 184, 0.18)' },
      },
    },
    series: visibleSeries.map(({ series, color }, index) => {
      const isFastestLapDriver = fastestLap?.driver === series.driver;

      return {
        name: series.driver,
        type: 'line',
        showSymbol: false,
        triggerLineEvent: true,
        smooth: 0.18,
        itemStyle: {
          color,
        },
        lineStyle: {
          width: 2,
          color,
        },
        emphasis: {
          focus: 'series',
          label: {
            show: true,
            formatter: series.driver,
            color,
            fontWeight: 800,
            position: 'top',
          },
          lineStyle: {
            width: 4,
          },
        },
        data: series.laps.map((lap) => [lap.lapNumber, lap.lapTimeSeconds]),
        markArea: index === 0 ? statusMarkArea : undefined,
        markPoint: isFastestLapDriver && fastestLap ? {
          symbol: 'circle',
          symbolSize: 12,
          z: 8,
          label: {
            show: false,
          },
          itemStyle: {
            color: '#ff1801',
            borderColor: '#fff',
            borderWidth: 2,
            shadowBlur: 8,
            shadowColor: 'rgba(255, 24, 1, 0.35)',
          },
          data: [{
            name: TEXT.fastestLap,
            coord: [fastestLap.lapNumber, fastestLap.lapTimeSeconds],
            value: formatSeconds(fastestLap.lapTimeSeconds),
          }],
        } : undefined,
        markLine: isFastestLapDriver && fastestLap ? {
          silent: true,
          symbol: ['none', 'none'],
          label: {
            show: true,
            formatter: `${TEXT.fastestLap} 路 ${fastestLap.driver}`,
            color: '#ff1801',
            fontSize: 11,
            fontWeight: 800,
            position: 'insideEndTop',
            distance: [0, 6],
            backgroundColor: 'rgba(255, 255, 255, 0.92)',
            borderColor: 'rgba(255, 24, 1, 0.2)',
            borderWidth: 1,
            borderRadius: 999,
            padding: [3, 8],
          },
          lineStyle: {
            color: '#ff1801',
            width: 1.5,
            type: 'dashed',
            opacity: 0.65,
          },
          data: [{
            xAxis: fastestLap.lapNumber,
          }],
        } : undefined,
      };
    }),
  };
}

function getStintAtIndex<T extends FastF1StrategyStint>(stints: T[], index: number) {
  return stints.find((stint) => stint.stint === index + 1) || null;
}

type StintPaceMetric = FastF1StrategyStint & {
  driver: string;
  averagePaceSeconds: number | null;
  degradationSeconds: number | null;
  previousDeltaSeconds: number | null;
};

function getStintPaceMetrics(
  analytics: FastF1RaceAnalytics,
  driver: string,
  stints: FastF1StrategyStint[],
) {
  const series = analytics.lapTimeSeries.find((item) => item.driver === driver);
  let previousAverage: number | null = null;

  return stints.map((stint): StintPaceMetric => {
    const lapTimes = (series?.laps || [])
      .filter((lap) => (
        Number.isFinite(lap.lapTimeSeconds)
        && lap.lapNumber >= stint.startLap
        && lap.lapNumber <= stint.endLap
      ))
      .sort((a, b) => a.lapNumber - b.lapNumber)
      .map((lap) => lap.lapTimeSeconds);

    const averagePaceSeconds = averageLapTimes(lapTimes);
    const firstAverage = averageLapTimes(lapTimes.slice(0, 3));
    const lastAverage = averageLapTimes(lapTimes.slice(-3));
    const degradationSeconds = firstAverage !== null && lastAverage !== null
      ? Number((lastAverage - firstAverage).toFixed(3))
      : null;
    const previousDeltaSeconds = averagePaceSeconds !== null && previousAverage !== null
      ? Number((averagePaceSeconds - previousAverage).toFixed(3))
      : null;

    if (averagePaceSeconds !== null) {
      previousAverage = averagePaceSeconds;
    }

    return {
      ...stint,
      driver,
      averagePaceSeconds,
      degradationSeconds,
      previousDeltaSeconds,
    };
  });
}

function buildStintTooltip(params: ChartTooltipParam) {
  const data = params.data as {
    stint?: StintPaceMetric;
    compoundLabel?: string;
    tyreAgeLabel?: string;
    tyreLifeLabel?: string | null;
  };
  const stint = data?.stint;

  if (!stint) {
    return '';
  }

  return `
    <div class="fastf1-tooltip">
      <div class="fastf1-tooltip-title">${escapeTooltipText(stint.driver)} - Stint ${stint.stint}</div>
      <div class="fastf1-tooltip-grid fastf1-tooltip-grid-stint">
        <div class="fastf1-tooltip-row">
          <span class="fastf1-tooltip-marker" style="background:${getCompoundColor(stint.compound)};"></span>
          <span class="fastf1-tooltip-name">${escapeTooltipText(data.compoundLabel || stint.compound)}</span>
          <strong>L${stint.startLap}-L${stint.endLap} (${stint.lapCount})</strong>
        </div>
        <div class="fastf1-tooltip-row">
          <span class="fastf1-tooltip-marker is-empty"></span>
          <span>${TEXT.tyreAge}</span>
          <strong class="fastf1-tyre-age-badge">${escapeTooltipText(data.tyreAgeLabel || getTyreAgeLabel(stint))}</strong>
        </div>
        <div class="fastf1-tooltip-row">
          <span class="fastf1-tooltip-marker is-empty"></span>
          <span>${TEXT.tyreLife}</span>
          <strong>${escapeTooltipText(data.tyreLifeLabel || formatTyreLife(stint) || '-')}</strong>
        </div>
        <div class="fastf1-tooltip-row">
          <span class="fastf1-tooltip-marker is-empty"></span>
          <span>${TEXT.stintPace}</span>
          <strong>${formatSessionSeconds(stint.averagePaceSeconds)}</strong>
        </div>
        <div class="fastf1-tooltip-row">
          <span class="fastf1-tooltip-marker is-empty"></span>
          <span>${TEXT.degradation}</span>
          <strong>${formatSignedSeconds(stint.degradationSeconds)}</strong>
        </div>
        <div class="fastf1-tooltip-row">
          <span class="fastf1-tooltip-marker is-empty"></span>
          <span>vs Prev Stint</span>
          <strong>${formatSignedSeconds(stint.previousDeltaSeconds)}</strong>
        </div>
      </div>
    </div>
  `;
}

function buildTyreStrategyOption(
  analytics: FastF1RaceAnalytics,
  highlightedDrivers: string[] = [],
  season: string | number = analytics.season,
  round: string | number | undefined = analytics.round,
) {
  const strategies = [...analytics.tyreStrategies].sort((a, b) => {
    const aPosition = a.racePosition ?? Number.MAX_SAFE_INTEGER;
    const bPosition = b.racePosition ?? Number.MAX_SAFE_INTEGER;
    return aPosition - bPosition;
  });
  const highlightedSet = new Set(highlightedDrivers);
  const hasHighlight = highlightedSet.size > 0;
  const metricStrategies = strategies.map((strategy) => ({
    ...strategy,
    stints: getStintPaceMetrics(analytics, strategy.driver, strategy.stints),
  }));
  const drivers = metricStrategies.map((strategy) => strategy.driver);
  const maxStints = Math.max(
    0,
    ...metricStrategies.map((strategy) => strategy.stints.length),
  );

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      appendToBody: true,
      borderWidth: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.92)',
      extraCssText: CHART_TOOLTIP_CSS,
      textStyle: {
        color: '#fff',
      },
      formatter: buildStintTooltip,
    },
    legend: {
      show: false,
    },
    grid: {
      top: 18,
      right: 24,
      bottom: 44,
      left: 68,
    },
    xAxis: {
      type: 'value',
      name: 'Laps',
      max: getMaxRaceLap(analytics),
      minInterval: 1,
      axisLine: {
        lineStyle: { color: '#cbd5e1' },
      },
      axisTick: {
        lineStyle: { color: '#cbd5e1' },
      },
      axisLabel: {
        color: '#64748b',
      },
      splitLine: {
        lineStyle: { color: 'rgba(148, 163, 184, 0.18)' },
      },
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: drivers,
      axisLine: {
        lineStyle: { color: '#cbd5e1' },
      },
      axisTick: {
        show: false,
      },
      axisLabel: {
        color: '#475569',
        fontWeight: 700,
      },
    },
    series: Array.from({ length: maxStints }, (_, index) => ({
      name: `Stint ${index + 1}`,
      type: 'bar',
      stack: 'stints',
      barMaxWidth: 18,
      data: metricStrategies.map((strategy) => {
        const stint = getStintAtIndex(strategy.stints, index);
        const isHighlighted = !hasHighlight || highlightedSet.has(strategy.driver);
        return {
          value: stint?.lapCount || 0,
          stint: stint || undefined,
          compoundLabel: stint ? formatCompoundWithCode(season, round, stint.compound) : '',
          tyreAgeLabel: stint ? getTyreAgeLabel(stint) : '',
          tyreLifeLabel: stint ? formatTyreLife(stint) : null,
          itemStyle: {
            color: stint ? getCompoundColor(stint.compound) : 'transparent',
            borderColor: 'rgba(15, 23, 42, 0.3)',
            borderWidth: stint ? 1 : 0,
            borderType: stint && getTyreAgeLabel(stint) === '\u65e7\u80ce' ? 'dashed' : 'solid',
            opacity: isHighlighted ? 1 : 0.22,
          },
        };
      }),
    })),
  };
}

function buildWeatherMarkArea(ranges: FastF1WeatherLapRange[] = []) {
  if (!ranges.length) {
    return undefined;
  }

  return {
    silent: true,
    label: {
      show: false,
    },
    data: ranges.map((range) => [
      {
        name: TEXT.rainfall,
        xAxis: range.startLap,
        itemStyle: {
          color: WEATHER_COLORS.rain,
          borderColor: WEATHER_COLORS.rainBorder,
          borderWidth: 1,
        },
      },
      {
        xAxis: Math.max(range.startLap, range.endLap),
      },
    ]),
  };
}

function buildWeatherTooltip(params: ChartTooltipInput) {
  const tooltipItems = Array.isArray(params) ? params : [params];
  const point = (tooltipItems.find((param) => param.data?.weather)?.data as { weather?: FastF1WeatherPoint } | undefined)
    ?.weather;

  if (!point) {
    return '';
  }

  const rows = tooltipItems
    .filter(hasNumericTooltipValue)
    .map((param) => `
      <div class="fastf1-tooltip-row">
        <span class="fastf1-tooltip-marker" style="background:${param.color};"></span>
        <span class="fastf1-tooltip-name">${escapeTooltipText(param.seriesName)}</span>
        <strong>${param.seriesName === TEXT.humidity ? formatPercent(param.value[1]) : formatTemperature(param.value[1])}</strong>
      </div>
    `)
    .join('');

  return `
    <div class="fastf1-tooltip">
      <div class="fastf1-tooltip-title">Lap ${escapeTooltipText(point.lapNumber ?? '-')}</div>
      <div class="fastf1-tooltip-grid">${rows}</div>
      <div class="fastf1-weather-tooltip-meta">
        <span>${TEXT.rainfall}: ${point.rainfall ? 'Yes' : 'No'}</span>
        <span>${TEXT.wind}: ${formatWindSpeed(point.windSpeedMps)}</span>
      </div>
    </div>
  `;
}

function averageNullable(
  points: FastF1WeatherPoint[],
  key: keyof Pick<
    FastF1WeatherPoint,
    'timeSeconds' | 'airTempC' | 'trackTempC' | 'humidityPct' | 'pressureHpa' | 'windDirectionDeg' | 'windSpeedMps'
  >,
) {
  const values = points
    .map((point) => point[key])
    .filter((value): value is number => value !== null && Number.isFinite(value));

  if (!values.length) {
    return null;
  }

  return Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(2));
}

function aggregateWeatherPointsByLap(points: FastF1WeatherPoint[]) {
  const grouped = new Map<number, FastF1WeatherPoint[]>();

  points.forEach((point) => {
    if (point.lapNumber === null) {
      return;
    }

    const current = grouped.get(point.lapNumber) || [];
    current.push(point);
    grouped.set(point.lapNumber, current);
  });

  return [...grouped.entries()]
    .sort(([a], [b]) => a - b)
    .map(([lapNumber, lapPoints]) => ({
      timeSeconds: averageNullable(lapPoints, 'timeSeconds') ?? lapPoints[0].timeSeconds,
      lapNumber,
      airTempC: averageNullable(lapPoints, 'airTempC'),
      trackTempC: averageNullable(lapPoints, 'trackTempC'),
      humidityPct: averageNullable(lapPoints, 'humidityPct'),
      pressureHpa: averageNullable(lapPoints, 'pressureHpa'),
      rainfall: lapPoints.some((point) => point.rainfall),
      windDirectionDeg: averageNullable(lapPoints, 'windDirectionDeg'),
      windSpeedMps: averageNullable(lapPoints, 'windSpeedMps'),
    }));
}

function buildWeatherOption(analytics: FastF1RaceAnalytics) {
  const weather = analytics.weather;
  const points = weather ? aggregateWeatherPointsByLap(weather.points) : [];

  if (!weather || !points?.length) {
    return null;
  }

  const rainMarkArea = buildWeatherMarkArea(weather.summary.rainLapRanges);
  const buildSeriesData = (
    key: 'trackTempC' | 'airTempC' | 'humidityPct',
  ) => points
    .filter((point) => point[key] !== null)
    .map((point) => ({
      value: [point.lapNumber, point[key]],
      weather: point,
    }));

  return {
    backgroundColor: 'transparent',
    color: [
      WEATHER_COLORS.trackTemp,
      WEATHER_COLORS.airTemp,
      WEATHER_COLORS.humidity,
    ],
    tooltip: {
      trigger: 'axis',
      appendToBody: true,
      borderWidth: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.92)',
      extraCssText: CHART_TOOLTIP_CSS,
      textStyle: {
        color: '#fff',
      },
      formatter: buildWeatherTooltip,
    },
    axisPointer: {
      link: [{ xAxisIndex: 'all' }],
      label: {
        backgroundColor: '#111827',
      },
      lineStyle: {
        color: '#94a3b8',
        type: 'dashed',
      },
    },
    legend: {
      top: 4,
      right: 8,
      textStyle: {
        color: '#475569',
        fontWeight: 700,
      },
    },
    grid: {
      top: 50,
      right: 58,
      bottom: 44,
      left: 68,
    },
    xAxis: {
      type: 'value',
      name: 'Lap',
      max: getMaxRaceLap(analytics),
      minInterval: 1,
      axisLine: {
        lineStyle: { color: '#cbd5e1' },
      },
      axisTick: {
        lineStyle: { color: '#cbd5e1' },
      },
      axisLabel: {
        color: '#64748b',
      },
      splitLine: {
        lineStyle: { color: 'rgba(148, 163, 184, 0.18)' },
      },
    },
    yAxis: [
      {
        type: 'value',
        name: 'C',
        scale: true,
        axisLabel: {
          formatter: (value: number) => `${value} C`,
          color: '#64748b',
        },
        axisLine: {
          lineStyle: { color: '#cbd5e1' },
        },
        splitLine: {
          lineStyle: { color: 'rgba(148, 163, 184, 0.18)' },
        },
      },
      {
        type: 'value',
        name: '%',
        min: 0,
        max: 100,
        axisLabel: {
          formatter: (value: number) => `${value}%`,
          color: '#64748b',
        },
        axisLine: {
          lineStyle: { color: '#cbd5e1' },
        },
        splitLine: {
          show: false,
        },
      },
    ],
    series: [
      {
        name: TEXT.trackTemp,
        type: 'line',
        showSymbol: false,
        smooth: 0.2,
        yAxisIndex: 0,
        itemStyle: {
          color: WEATHER_COLORS.trackTemp,
        },
        lineStyle: {
          width: 2.5,
          color: WEATHER_COLORS.trackTemp,
        },
        data: buildSeriesData('trackTempC'),
        markArea: rainMarkArea,
      },
      {
        name: TEXT.airTemp,
        type: 'line',
        showSymbol: false,
        smooth: 0.2,
        yAxisIndex: 0,
        itemStyle: {
          color: WEATHER_COLORS.airTemp,
        },
        lineStyle: {
          width: 2,
          color: WEATHER_COLORS.airTemp,
        },
        data: buildSeriesData('airTempC'),
      },
      {
        name: TEXT.humidity,
        type: 'line',
        showSymbol: false,
        smooth: 0.2,
        yAxisIndex: 1,
        itemStyle: {
          color: WEATHER_COLORS.humidity,
        },
        lineStyle: {
          width: 2,
          color: WEATHER_COLORS.humidity,
          type: 'dashed',
        },
        data: buildSeriesData('humidityPct'),
      },
    ],
  };
}

function getTyreTimelineRows(
  analytics: FastF1RaceAnalytics,
  highlightedDrivers: string[] = [],
) {
  const highlightedSet = new Set(highlightedDrivers);
  const hasHighlight = highlightedSet.size > 0;

  return [...analytics.tyreStrategies]
    .sort((a, b) => {
      const aPosition = a.racePosition ?? Number.MAX_SAFE_INTEGER;
      const bPosition = b.racePosition ?? Number.MAX_SAFE_INTEGER;
      return aPosition - bPosition;
    })
    .map((strategy) => ({
      ...strategy,
      isMuted: hasHighlight && !highlightedSet.has(strategy.driver),
      stints: getStintPaceMetrics(analytics, strategy.driver, strategy.stints),
    }));
}

function TyreStrategyTimeline({
  analytics,
  highlightedDrivers,
  season,
  round,
}: {
  analytics: FastF1RaceAnalytics;
  highlightedDrivers: string[];
  season: string;
  round?: string;
}) {
  const maxLap = Math.max(1, getMaxRaceLap(analytics));
  const rows = getTyreTimelineRows(analytics, highlightedDrivers);

  return (
    <div className="tyre-broadcast-timeline" style={{ ['--max-lap' as string]: maxLap }}>
      {rows.map((strategy) => (
        <div
          key={strategy.driver}
          className={`tyre-timeline-row${strategy.isMuted ? ' is-muted' : ''}`}
        >
          <div className="tyre-timeline-driver">{strategy.driver}</div>
          <div className="tyre-timeline-track">
            {strategy.stints.map((stint) => {
              const startPct = ((stint.startLap - 1) / maxLap) * 100;
              const widthPct = (stint.lapCount / maxLap) * 100;
              const ageLabel = getTyreAgeLabel(stint);
              const compoundLabel = formatCompoundWithCode(season, round, stint.compound);
              const tyreLife = formatTyreLife(stint);
              const stintLabel = `Stint ${stint.stint}`;
              const lapRangeLabel = `L${stint.startLap}-L${stint.endLap}`;
              const tyreTooltipLabel = `${strategy.driver} ${compoundLabel} ${ageLabel} ${lapRangeLabel}${tyreLife ? ` ${tyreLife}` : ''}`;

              const endLabelClassName = stint.stint % 2 === 0
                ? 'tyre-stint-end-label is-below'
                : 'tyre-stint-end-label';

              return (
                <div
                  key={`${strategy.driver}-${stint.stint}`}
                  className={`tyre-stint-line${ageLabel === '\u65e7\u80ce' ? ' is-used' : ' is-new'}`}
                  style={{
                    left: `${startPct}%`,
                    width: `${Math.max(widthPct, 0.8)}%`,
                    ['--compound-color' as string]: getCompoundColor(stint.compound),
                  }}
                  aria-label={tyreTooltipLabel}
                  tabIndex={0}
                >
                  <span className="tyre-stint-segment tyre-stint-segment-left" />
                  <span className="tyre-stint-segment tyre-stint-segment-right" />
                  <span className={endLabelClassName}>{stint.endLap}</span>
                  <span className="tyre-stint-tooltip" role="tooltip">
                    <span className="tyre-stint-tooltip-header">
                      <span className="tyre-stint-tooltip-compound">
                        <span className="tyre-stint-tooltip-swatch" />
                        <span>
                          <strong>{compoundLabel}</strong>
                          <em>{ageLabel}</em>
                        </span>
                      </span>
                      <span className="tyre-stint-tooltip-stint">{stintLabel}</span>
                    </span>
                    <span className="tyre-stint-tooltip-driver">{strategy.driver}</span>
                    <span className="tyre-stint-tooltip-grid">
                      <span>
                        <small>{'\u5708\u6bb5'}</small>
                        <strong>{lapRangeLabel}</strong>
                      </span>
                      <span>
                        <small>{'\u5708\u6570'}</small>
                        <strong>{stint.lapCount}</strong>
                      </span>
                      <span>
                        <small>{TEXT.tyreLife}</small>
                        <strong>{tyreLife || '-'}</strong>
                      </span>
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
          <div className="tyre-timeline-finish">{maxLap}</div>
        </div>
      ))}
    </div>
  );
}

function getDuelDriverItems(analytics: FastF1RaceAnalytics | null) {
  return (analytics?.lapTimeSeries || []).map((series, index) => ({
    driver: series.driver,
    team: series.team,
    color: getDriverColor(index),
  }));
}

function getSelectedDuelDrivers(
  analytics: FastF1RaceAnalytics | null,
  selectedDrivers: string[],
) {
  if (!analytics || selectedDrivers.length !== 2) {
    return [];
  }

  const selectedSet = new Set(selectedDrivers);
  return analytics.lapTimeSeries.filter((series) => selectedSet.has(series.driver));
}

function averageLapTimes(values: number[]) {
  if (!values.length) {
    return null;
  }

  return Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(3));
}

function getDuelTyreSummaryItems(
  analytics: FastF1RaceAnalytics | null,
  selectedDrivers: string[],
) {
  if (!analytics || selectedDrivers.length !== 2) {
    return [];
  }

  return selectedDrivers
    .map((driver) => {
      const strategy = analytics.tyreStrategies.find((item) => item.driver === driver);

      if (!strategy) {
        return null;
      }

      return {
        driver,
        stints: getStintPaceMetrics(analytics, driver, strategy.stints),
      };
    })
    .filter((item): item is { driver: string; stints: StintPaceMetric[] } => item !== null);
}

function getDuelSectorRows(
  qualifyingAnalytics: FastF1RaceAnalytics | null,
  selectedDrivers: string[],
) {
  if (selectedDrivers.length !== 2) {
    return [];
  }

  const selectedSet = new Set(selectedDrivers);
  return (qualifyingAnalytics?.qualifyingAnalysis?.bestLaps || [])
    .filter((lap) => selectedSet.has(lap.driver))
    .sort((a, b) => selectedDrivers.indexOf(a.driver) - selectedDrivers.indexOf(b.driver))
    .map((lap) => ({
      key: lap.driver,
      driver: lap.driver,
      fastestLap: lap.lapTimeSeconds,
      s1: lap.sector1Seconds,
      s2: lap.sector2Seconds,
      s3: lap.sector3Seconds,
    }));
}

function getDuelSectorGapItems(
  qualifyingAnalytics: FastF1RaceAnalytics | null,
  selectedDrivers: string[],
) {
  const rows = getDuelSectorRows(qualifyingAnalytics, selectedDrivers);

  if (rows.length !== 2) {
    return [];
  }

  const [first, second] = rows;
  const delta = (firstValue: number | null | undefined, secondValue: number | null | undefined) => (
    firstValue !== null
    && firstValue !== undefined
    && secondValue !== null
    && secondValue !== undefined
    && Number.isFinite(firstValue)
    && Number.isFinite(secondValue)
      ? Number((firstValue - secondValue).toFixed(3))
      : null
  );

  return [
    {
      key: 'total',
      label: TEXT.fastestLap,
      value: delta(first.fastestLap, second.fastestLap),
      firstDriver: first.driver,
      secondDriver: second.driver,
    },
    {
      key: 's1',
      label: TEXT.sector1,
      value: delta(first.s1, second.s1),
      firstDriver: first.driver,
      secondDriver: second.driver,
    },
    {
      key: 's2',
      label: TEXT.sector2,
      value: delta(first.s2, second.s2),
      firstDriver: first.driver,
      secondDriver: second.driver,
    },
    {
      key: 's3',
      label: TEXT.sector3,
      value: delta(first.s3, second.s3),
      firstDriver: first.driver,
      secondDriver: second.driver,
    },
  ];
}

function getDuelCornerRows(
  analytics: FastF1RaceAnalytics | null,
  selectedDrivers: string[],
) {
  if (!analytics?.telemetry || selectedDrivers.length !== 2) {
    return [];
  }

  const [driverA, driverB] = selectedDrivers;
  return analytics.telemetry.cornerAnalysis.map((corner) => {
    const first = corner.drivers.find((driver) => driver.driver === driverA);
    const second = corner.drivers.find((driver) => driver.driver === driverB);
    const delta = first?.minSpeedKph !== null
      && first?.minSpeedKph !== undefined
      && second?.minSpeedKph !== null
      && second?.minSpeedKph !== undefined
      ? Number((first.minSpeedKph - second.minSpeedKph).toFixed(1))
      : null;

    return {
      key: `${corner.corner}-${corner.distanceM}`,
      corner: corner.corner,
      distanceM: corner.distanceM,
      driverA,
      driverB,
      firstMinSpeed: first?.minSpeedKph ?? null,
      secondMinSpeed: second?.minSpeedKph ?? null,
      delta,
    };
  });
}

function getTelemetryDriverColor(driver: string, drivers: FastF1TelemetryDriver[]) {
  const index = Math.max(0, drivers.findIndex((item) => item.driver === driver));
  return getDriverColor(index);
}

function getActiveTelemetryDrivers(
  analytics: FastF1RaceAnalytics | null,
  selectedDrivers: string[],
) {
  const drivers = analytics?.telemetry?.drivers || [];
  const selectedSet = new Set(selectedDrivers);

  return drivers.filter((driver) => selectedSet.has(driver.driver));
}

function getTelemetryMaxDistance(drivers: FastF1TelemetryDriver[]) {
  const distances = drivers.flatMap((driver) =>
    driver.samples
      .map((sample) => sample.distanceM)
      .filter((distance) => Number.isFinite(distance)),
  );

  if (!distances.length) {
    return undefined;
  }

  return Math.max(...distances);
}

function getTelemetryChartDrivers(
  analytics: FastF1RaceAnalytics,
  activeDrivers: FastF1TelemetryDriver[],
) {
  return activeDrivers.length ? activeDrivers : analytics.telemetry?.drivers || [];
}

function buildTelemetryCornerMarkLines(analytics: FastF1RaceAnalytics) {
  const corners = analytics.telemetry?.corners || [];
  const visibleCorners = corners.filter((corner) =>
    corner.distanceM !== null && Number.isFinite(corner.distanceM),
  );

  if (!visibleCorners.length) {
    return undefined;
  }

  return {
    silent: true,
    symbol: ['none', 'none'],
    label: {
      show: true,
      rotate: 90,
      formatter: (param: ChartTooltipParam) => param.name || '',
      color: '#475569',
      fontSize: 10,
      fontWeight: 800,
      position: 'middle',
      backgroundColor: 'rgba(255, 255, 255, 0.86)',
      borderColor: 'rgba(148, 163, 184, 0.28)',
      borderWidth: 1,
      borderRadius: 999,
      padding: [2, 5],
    },
    lineStyle: {
      color: 'rgba(100, 116, 139, 0.28)',
      width: 1,
      type: 'dashed',
    },
    data: visibleCorners.map((corner) => ({
      name: corner.label,
      xAxis: corner.distanceM,
    })),
  };
}

function buildTelemetrySpeedTooltip(params: ChartTooltipInput) {
  const tooltipItems = (Array.isArray(params) ? params : [params])
    .filter(hasNumericTooltipValue);

  if (!tooltipItems.length) {
    return '';
  }

  const distance = tooltipItems[0]?.value?.[0] ?? '-';
  const rows = tooltipItems.map((param) => `\n    <div class="fastf1-tooltip-row">\n      <span class="fastf1-tooltip-marker" style="background:${param.color};"></span>\n      <span class="fastf1-tooltip-name">${escapeTooltipText(param.seriesName)}</span>\n      <strong>${formatSpeed(param.value[1])}</strong>\n    </div>\n  `).join('');

  return `\n    <div class="fastf1-tooltip">\n      <div class="fastf1-tooltip-title">${TEXT.speed} ${formatNumber(distance, 0)} m</div>\n      <div class="fastf1-tooltip-grid">${rows}</div>\n    </div>\n  `;
}

function buildTelemetryControlTooltip(params: ChartTooltipInput) {
  const tooltipItems = (Array.isArray(params) ? params : [params])
    .filter(hasNumericTooltipValue);

  if (!tooltipItems.length) {
    return '';
  }

  const distance = tooltipItems[0]?.value?.[0] ?? '-';
  const rows = tooltipItems.map((param) => {
    const metric = param.data?.metric;
    const value = param.value[1];
    const formatted = metric === 'rpm'
      ? formatRpm(value)
      : metric === 'gear'
        ? `${formatNumber(value, 0)}`
        : `${formatNumber(value, 0)}%`;

    return `\n      <div class="fastf1-tooltip-row">\n        <span class="fastf1-tooltip-marker" style="background:${param.color};"></span>\n        <span class="fastf1-tooltip-name">${escapeTooltipText(param.seriesName)}</span>\n        <strong>${formatted}</strong>\n      </div>\n    `;
  }).join('');

  return `\n    <div class="fastf1-tooltip">\n      <div class="fastf1-tooltip-title">${formatNumber(distance, 0)} m</div>\n      <div class="fastf1-tooltip-grid">${rows}</div>\n    </div>\n  `;
}

function buildTelemetrySpeedOption(
  analytics: FastF1RaceAnalytics,
  activeDrivers: FastF1TelemetryDriver[],
) {
  if (!analytics.telemetry) {
    return null;
  }

  const cornerMarkLines = buildTelemetryCornerMarkLines(analytics);
  const chartDrivers = getTelemetryChartDrivers(analytics, activeDrivers);
  const driverSeries = activeDrivers.map((driver, index) => ({
    name: `${driver.driver} ${TEXT.speed}`,
    type: 'line',
    showSymbol: false,
    smooth: 0.12,
    itemStyle: {
      color: getTelemetryDriverColor(driver.driver, analytics.telemetry?.drivers || []),
    },
    lineStyle: {
      width: 2.4,
    },
    emphasis: {
      focus: 'series',
    },
    data: driver.samples
      .filter((sample) => sample.speedKph !== null)
      .map((sample) => [sample.distanceM, sample.speedKph]),
    markLine: index === 0 ? cornerMarkLines : undefined,
  }));

  return {
    backgroundColor: 'transparent',
    color: activeDrivers.map((driver) => getTelemetryDriverColor(driver.driver, analytics.telemetry?.drivers || [])),
    tooltip: {
      trigger: 'axis',
      appendToBody: true,
      borderWidth: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.92)',
      extraCssText: CHART_TOOLTIP_CSS,
      textStyle: {
        color: '#fff',
      },
      formatter: buildTelemetrySpeedTooltip,
    },
    axisPointer: {
      label: {
        backgroundColor: '#111827',
      },
      lineStyle: {
        color: '#94a3b8',
        type: 'dashed',
      },
    },
    legend: {
      show: false,
    },
    grid: {
      top: 18,
      right: 28,
      bottom: 44,
      left: 62,
    },
    xAxis: {
      type: 'value',
      name: 'm',
      min: 0,
      max: getTelemetryMaxDistance(chartDrivers),
      axisLine: {
        lineStyle: { color: '#cbd5e1' },
      },
      axisTick: {
        lineStyle: { color: '#cbd5e1' },
      },
      axisLabel: {
        color: '#64748b',
      },
      splitLine: {
        lineStyle: { color: 'rgba(148, 163, 184, 0.18)' },
      },
    },
    yAxis: {
      type: 'value',
      name: 'km/h',
      scale: true,
      axisLabel: {
        color: '#64748b',
      },
      axisLine: {
        lineStyle: { color: '#cbd5e1' },
      },
      splitLine: {
        lineStyle: { color: 'rgba(148, 163, 184, 0.18)' },
      },
    },
    series: driverSeries.length ? driverSeries : [{
      name: TEXT.speed,
      type: 'line',
      showSymbol: false,
      silent: true,
      lineStyle: { opacity: 0 },
      data: [],
      markLine: cornerMarkLines,
    }],
  };
}

function buildTelemetryControlSeries(
  driver: FastF1TelemetryDriver,
  allDrivers: FastF1TelemetryDriver[],
  selectedMetrics: TelemetryMetric[],
) {
  const color = getTelemetryDriverColor(driver.driver, allDrivers);
  const samples = driver.samples;
  const selectedMetricSet = new Set(selectedMetrics);

  const metricData = (
    metric: 'throttle' | 'brake' | 'gear' | 'rpm',
    selector: (sample: FastF1TelemetrySample) => number | null,
  ) => samples
    .map((sample) => {
      const value = selector(sample);
      if (value === null || !Number.isFinite(value)) {
        return null;
      }

      return {
        value: [sample.distanceM, value],
        metric,
      };
    })
    .filter(Boolean);

  return [
    {
      metric: 'throttle' as TelemetryMetric,
      name: `${driver.driver} ${TEXT.throttle}`,
      type: 'line',
      showSymbol: false,
      smooth: 0.08,
      yAxisIndex: 0,
      itemStyle: { color },
      lineStyle: { width: 2.4, color, opacity: 0.92 },
      emphasis: { focus: 'series' },
      data: metricData('throttle', (sample) => sample.throttlePct),
    },
    {
      metric: 'brake' as TelemetryMetric,
      name: `${driver.driver} ${TEXT.brake}`,
      type: 'line',
      showSymbol: false,
      step: 'middle',
      yAxisIndex: 0,
      itemStyle: { color },
      lineStyle: { width: 2, color, type: 'dashed', opacity: 0.76 },
      emphasis: { focus: 'series' },
      data: metricData('brake', (sample) => (sample.brake ? 100 : 0)),
    },
    {
      metric: 'gear' as TelemetryMetric,
      name: `${driver.driver} ${TEXT.gear}`,
      type: 'line',
      showSymbol: false,
      step: 'middle',
      yAxisIndex: 1,
      itemStyle: { color },
      lineStyle: { width: 1.9, color, type: 'dotted', opacity: 0.82 },
      emphasis: { focus: 'series' },
      data: metricData('gear', (sample) => sample.gear),
    },
    {
      metric: 'rpm' as TelemetryMetric,
      name: `${driver.driver} ${TEXT.rpm}`,
      type: 'line',
      showSymbol: false,
      smooth: 0.08,
      yAxisIndex: 2,
      itemStyle: { color },
      lineStyle: { width: 1.4, color, type: [6, 3, 1, 3], opacity: 0.58 },
      emphasis: { focus: 'series' },
      data: metricData('rpm', (sample) => sample.rpm),
    },
  ].filter((series) => selectedMetricSet.has(series.metric));
}

function buildTelemetryControlOption(
  analytics: FastF1RaceAnalytics,
  activeDrivers: FastF1TelemetryDriver[],
  selectedMetrics: TelemetryMetric[],
) {
  if (!analytics.telemetry) {
    return null;
  }

  const cornerMarkLines = buildTelemetryCornerMarkLines(analytics);
  const chartDrivers = getTelemetryChartDrivers(analytics, activeDrivers);
  const controlSeries = activeDrivers.flatMap((driver) =>
    buildTelemetryControlSeries(
      driver,
      analytics.telemetry?.drivers || [],
      selectedMetrics,
    ),
  ).map((series, index) => ({
    ...series,
    markLine: index === 0 ? cornerMarkLines : undefined,
  }));

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      appendToBody: true,
      borderWidth: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.92)',
      extraCssText: CHART_TOOLTIP_CSS,
      textStyle: {
        color: '#fff',
      },
      formatter: buildTelemetryControlTooltip,
    },
    axisPointer: {
      label: {
        backgroundColor: '#111827',
      },
      lineStyle: {
        color: '#94a3b8',
        type: 'dashed',
      },
    },
    legend: {
      show: false,
    },
    grid: {
      top: 18,
      right: 86,
      bottom: 44,
      left: 58,
    },
    xAxis: {
      type: 'value',
      name: 'm',
      min: 0,
      max: getTelemetryMaxDistance(chartDrivers),
      axisLine: {
        lineStyle: { color: '#cbd5e1' },
      },
      axisTick: {
        lineStyle: { color: '#cbd5e1' },
      },
      axisLabel: {
        color: '#64748b',
      },
      splitLine: {
        lineStyle: { color: 'rgba(148, 163, 184, 0.18)' },
      },
    },
    yAxis: [
      {
        type: 'value',
        name: '%',
        min: 0,
        max: 100,
        axisLabel: {
          color: '#64748b',
        },
        axisLine: {
          lineStyle: { color: '#cbd5e1' },
        },
        splitLine: {
          lineStyle: { color: 'rgba(148, 163, 184, 0.18)' },
        },
      },
      {
        type: 'value',
        name: TEXT.gear,
        min: 0,
        max: 8,
        position: 'right',
        axisLabel: {
          color: '#64748b',
        },
        axisLine: {
          lineStyle: { color: '#cbd5e1' },
        },
        splitLine: {
          show: false,
        },
      },
      {
        type: 'value',
        name: TEXT.rpm,
        scale: true,
        position: 'right',
        offset: 46,
        axisLabel: {
          formatter: (value: number) => `${Math.round(value / 1000)}k`,
          color: '#64748b',
        },
        axisLine: {
          lineStyle: { color: '#cbd5e1' },
        },
        splitLine: {
          show: false,
        },
      },
    ],
    series: controlSeries.length ? controlSeries : [{
      name: TEXT.telemetryComparison,
      type: 'line',
      showSymbol: false,
      silent: true,
      lineStyle: { opacity: 0 },
      data: [],
      markLine: cornerMarkLines,
    }],
  };
}

function speedHeatColor(value: number | null | undefined, minSpeed: number, maxSpeed: number) {
  if (value === null || value === undefined || !Number.isFinite(value) || minSpeed === maxSpeed) {
    return '#94a3b8';
  }

  const ratio = Math.max(0, Math.min(1, (value - minSpeed) / (maxSpeed - minSpeed)));
  if (ratio < 0.25) {
    return '#2563eb';
  }
  if (ratio < 0.5) {
    return '#16a34a';
  }
  if (ratio < 0.75) {
    return '#f59e0b';
  }
  return '#dc2626';
}

function buildTrackHeatTooltip(params: ChartTooltipParam) {
  const data = params.data as { driver?: string; speedKph?: number | null } | undefined;
  if (!data?.driver) {
    return '';
  }

  return `\n    <div class="fastf1-tooltip fastf1-tooltip-single">\n      <div class="fastf1-tooltip-title">${escapeTooltipText(data.driver)}</div>\n      <div class="fastf1-tooltip-driver">\n        <span class="fastf1-tooltip-marker" style="background:${params.color};"></span>\n        <span>${TEXT.speed}</span>\n        <strong>${formatSpeed(data.speedKph)}</strong>\n      </div>\n    </div>\n  `;
}

function buildTrackHeatCornerSeries(analytics: FastF1RaceAnalytics) {
  const corners = analytics.telemetry?.corners || [];
  return {
    name: TEXT.corner,
    type: 'scatter',
    symbolSize: 1,
    silent: true,
    label: {
      show: true,
      formatter: (param: ChartTooltipParam) => String(param.data?.label || ''),
      color: '#475569',
      fontSize: 10,
      fontWeight: 800,
      backgroundColor: 'rgba(255, 255, 255, 0.86)',
      borderColor: 'rgba(148, 163, 184, 0.28)',
      borderWidth: 1,
      borderRadius: 999,
      padding: [2, 5],
    },
    itemStyle: {
      color: 'transparent',
    },
    data: corners
      .filter((corner) => corner.x !== null && corner.y !== null)
      .map((corner) => ({
        value: [corner.x, corner.y],
        label: corner.label,
      })),
  };
}

function buildTelemetryHeatmapOption(
  analytics: FastF1RaceAnalytics,
  activeDrivers: FastF1TelemetryDriver[],
) {
  if (!analytics.telemetry) {
    return null;
  }

  const chartDrivers = getTelemetryChartDrivers(analytics, activeDrivers);
  const allSpeeds = chartDrivers.flatMap((driver) =>
    driver.positionSamples
      .map((sample) => sample.speedKph)
      .filter((speed): speed is number => speed !== null && Number.isFinite(speed)),
  );
  const minSpeed = allSpeeds.length ? Math.min(...allSpeeds) : 0;
  const maxSpeed = allSpeeds.length ? Math.max(...allSpeeds) : 1;
  const heatSeries = activeDrivers.flatMap((driver) => {
    const points = driver.positionSamples
      .filter((sample) => sample.speedKph !== null)
      .sort((a, b) => a.distanceM - b.distanceM);

    return points.slice(0, -1).map((point, index) => {
      const next = points[index + 1];
      const speed = point.speedKph;

      return {
        name: driver.driver,
        type: 'lines',
        coordinateSystem: 'cartesian2d',
        polyline: false,
        silent: false,
        progressive: 0,
        data: [{
          coords: [
            [point.x, point.y],
            [next.x, next.y],
          ],
          driver: driver.driver,
          speedKph: speed,
        }],
        lineStyle: {
          width: activeDrivers.length > 1 ? 2.4 : 3.2,
          opacity: activeDrivers.length > 1 ? 0.72 : 0.92,
          color: speedHeatColor(speed, minSpeed, maxSpeed),
        },
        emphasis: {
          lineStyle: {
            width: 4,
            opacity: 1,
          },
        },
      };
    });
  });

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      appendToBody: true,
      borderWidth: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.92)',
      extraCssText: CHART_TOOLTIP_CSS,
      textStyle: {
        color: '#fff',
      },
      formatter: buildTrackHeatTooltip,
    },
    grid: {
      top: 18,
      right: 18,
      bottom: 18,
      left: 18,
    },
    xAxis: {
      type: 'value',
      show: false,
      scale: true,
    },
    yAxis: {
      type: 'value',
      show: false,
      scale: true,
    },
    series: [
      ...heatSeries,
      buildTrackHeatCornerSeries(analytics),
    ],
  };
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

function buildFastF1Summary(analytics: FastF1RaceAnalytics | null) {
  if (!analytics) {
    return null;
  }

  const lapNumbers = analytics.lapTimeSeries.flatMap((series) =>
    series.laps.map((lap) => lap.lapNumber),
  );
  const maxLap = analytics.totalLaps || Math.max(0, ...lapNumbers);
  const stints = analytics.tyreStrategies.reduce((total, strategy) =>
    total + strategy.stints.length, 0);
  const compounds = [...new Set(
    analytics.tyreStrategies.flatMap((strategy) =>
      strategy.stints.map((stint) => stint.compound || 'UNKNOWN'),
    ),
  )];
  const statusCount = analytics.trackStatusPeriods?.length || 0;

  return {
    driverCount: analytics.lapTimeSeries.length,
    maxLap,
    stints,
    compounds,
    statusCount,
    weatherSummary: analytics.weather?.summary || null,
  };
}

function getDriverLegendItems(series: FastF1DriverLapSeries[]) {
  return series.map((item, index) => ({
    driver: item.driver,
    color: getDriverColor(index),
  }));
}

function getBestLapByDriver(analytics: FastF1RaceAnalytics | null) {
  return new Map(
    analytics?.qualifyingAnalysis?.bestLaps.map((lap) => [lap.driver, lap]) || [],
  );
}

interface FastF1SprintLapSummary {
  driver: string;
  position: number | null;
  lapCount: number;
  lapNumber: number | null;
  lapTimeSeconds: number | null;
}

type ParticipantRecord = Result | QualifyingResult;

function normalizeLookupKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

function buildDriverLookup(records: ParticipantRecord[]) {
  const drivers = new Map<string, Driver>();

  records.forEach((record) => {
    const code = record.Driver.code;
    if (code && !drivers.has(code)) {
      drivers.set(code, record.Driver);
    }
  });

  return drivers;
}

function buildConstructorLookup(records: ParticipantRecord[]) {
  const constructors = new Map<string, Constructor>();

  records.forEach((record) => {
    const name = record.Constructor.name;
    if (name) {
      constructors.set(normalizeLookupKey(name), record.Constructor);
    }
  });

  return constructors;
}

function getFastF1SprintLapByDriver(analytics: FastF1RaceAnalytics | null) {
  const summaries = (analytics?.lapTimeSeries || []).map((series) => {
    const fastestLap = series.laps
      .filter((lap) => Number.isFinite(lap.lapTimeSeconds))
      .sort((a, b) => a.lapTimeSeconds - b.lapTimeSeconds)[0];

    return {
      driver: series.driver,
      position: series.racePosition ?? null,
      lapCount: series.laps.length,
      lapNumber: fastestLap?.lapNumber ?? null,
      lapTimeSeconds: fastestLap?.lapTimeSeconds ?? null,
    };
  });

  return new Map(summaries.map((summary) => [summary.driver, summary]));
}

function buildFallbackDriver(
  code: string,
  driverByCode: Map<string, Driver> = new Map(),
  result?: FastF1SessionResult,
): Driver {
  const [firstName = code, ...lastNameParts] = (result?.fullName || '').split(' ').filter(Boolean);

  return driverByCode.get(code) || {
    driverId: result?.driverId || code.toLowerCase(),
    permanentNumber: result?.driverNumber || '',
    code,
    url: '',
    givenName: result?.firstName || firstName || code,
    familyName: result?.lastName || lastNameParts.join(' '),
    dateOfBirth: '',
    nationality: '',
  };
}

function buildFallbackConstructor(
  name: string,
  constructorByName: Map<string, Constructor> = new Map(),
): Constructor {
  return constructorByName.get(normalizeLookupKey(name)) || {
    constructorId: name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'unknown',
    url: '',
    name: name || '-',
    nationality: '',
  };
}

function buildSessionResultByDriver(analytics: FastF1RaceAnalytics | null) {
  return new Map(
    (analytics?.sessionResults || []).map((result) => [result.driver, result]),
  );
}

function buildFastF1QualifyingRows(
  analytics: FastF1RaceAnalytics | null,
  driverByCode: Map<string, Driver>,
  constructorByName: Map<string, Constructor>,
): QualifyingResult[] {
  const phaseResults = analytics?.qualifyingAnalysis?.phaseResults || [];
  const bestLaps = analytics?.qualifyingAnalysis?.bestLaps || [];

  if (!phaseResults.length && !bestLaps.length) {
    return [];
  }

  const phaseByDriver = new Map(phaseResults.map((result) => [result.driver, result]));
  const sessionResultByDriver = buildSessionResultByDriver(analytics);
  const rows = (phaseResults.length ? phaseResults : bestLaps)
    .map((item) => {
      const phaseResult = phaseByDriver.get(item.driver);
      const sessionResult = sessionResultByDriver.get(item.driver);
      return {
        number: '',
        position: String(item.position || sessionResult?.position || ''),
        Driver: buildFallbackDriver(item.driver, driverByCode, sessionResult),
        Constructor: buildFallbackConstructor(item.team, constructorByName),
        Q1: phaseResult?.phases.q1?.time || undefined,
        Q2: phaseResult?.phases.q2?.time || undefined,
        Q3: phaseResult?.phases.q3?.time || undefined,
      };
    });

  return rows.sort((a, b) => Number(a.position) - Number(b.position));
}

function buildFastF1SprintRows(
  analytics: FastF1RaceAnalytics | null,
  driverByCode: Map<string, Driver>,
  constructorByName: Map<string, Constructor>,
): Result[] {
  const sessionResults = analytics?.sessionResults || [];
  const lapSeries = analytics?.lapTimeSeries || [];
  const lapSummaryByDriver = getFastF1SprintLapByDriver(analytics);

  if (sessionResults.length) {
    return sessionResults
      .map((result, index) => {
        const lapSummary = lapSummaryByDriver.get(result.driver);

        return {
          number: result.driverNumber,
          position: String(result.position ?? index + 1),
          positionText: String(result.classifiedPosition || result.position || index + 1),
          points: result.points === null || result.points === undefined ? '0' : String(result.points),
          Driver: buildFallbackDriver(result.driver, driverByCode, result),
          Constructor: buildFallbackConstructor(result.team, constructorByName),
          grid: result.gridPosition === null || result.gridPosition === undefined ? '-' : String(result.gridPosition),
          laps: result.laps === null || result.laps === undefined ? String(lapSummary?.lapCount || '') : String(result.laps),
          status: result.time || result.status || 'Finished',
          FastestLap: lapSummary?.lapTimeSeconds ? {
            rank: '',
            lap: lapSummary.lapNumber === null ? '' : String(lapSummary.lapNumber),
            Time: {
              time: formatSessionSeconds(lapSummary.lapTimeSeconds),
            },
            AverageSpeed: {
              units: 'kph',
              speed: '',
            },
          } : undefined,
        };
      })
      .sort((a, b) => Number(a.position) - Number(b.position));
  }

  return lapSeries
    .map((series, index) => ({
      number: '',
      position: String(series.racePosition ?? index + 1),
      positionText: String(series.racePosition ?? index + 1),
      points: '0',
      Driver: buildFallbackDriver(series.driver, driverByCode),
      Constructor: buildFallbackConstructor(series.team, constructorByName),
      grid: '-',
      laps: String(series.laps.length),
      status: '',
    }))
    .sort((a, b) => Number(a.position) - Number(b.position));
}

const RaceDetail = () => {
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
      { label: TEXT.historicalRaces, value: String(racePreviewSummary?.sampleSize || 0), detail: TEXT.sampleSize },
      { label: TEXT.poleConversion, value: formatProbability(racePreviewSummary?.poleWinConversionPct), detail: TEXT.pole },
      { label: TEXT.interruptionRisk, value: formatProbability(averageInterruptionRisk), detail: interruptionItems.map((item) => item.type).join(' / ') || '-' },
    ];
  }, [racePreviewSummary]);
  const raceUpgradeMetrics = useMemo(() => [
    {
      label: TEXT.upgradeTotal,
      value: String(raceUpgradeSummary?.totalDeclaredUpgradeCount || 0),
      detail: raceUpgradeSummary?.grandPrix || '-',
    },
    {
      label: TEXT.upgradeIntensity,
      value: String(raceUpgradeSummary?.totalDeclaredUpgradeIntensity || 0),
      detail: raceUpgradeSummary?.source || '-',
    },
    {
      label: TEXT.upgradeTeams,
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
        title: TEXT.fastestLap,
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
      { title: TEXT.rank, dataIndex: 'position', key: 'position', width: 60 },
      {
        title: TEXT.driver,
        key: 'driver',
        render: (_: unknown, record: QualifyingResult) => (
          <div>
            <div
              className="driver-name"
              onClick={() => navigate(`/drivers/${record.Driver.driverId}`)}
            >
              {record.Driver.givenName} {record.Driver.familyName}
            </div>
            <div className="driver-code">{record.Driver.code}</div>
          </div>
        ),
      },
      {
        title: TEXT.constructor,
        key: 'constructor',
        render: (_: unknown, record: QualifyingResult) => (
          <span
            className="constructor-name"
            onClick={() => navigate(`/constructors/${record.Constructor.constructorId}`)}
          >
            {record.Constructor.name}
          </span>
        ),
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
      { title: TEXT.rank, dataIndex: 'position', key: 'position', width: 60 },
      { title: TEXT.grid, dataIndex: 'grid', key: 'grid', width: 60 },
      {
        title: TEXT.driver,
        key: 'driver',
        render: (_: unknown, record: Result) => (
          <div>
            <div
              className="driver-name"
              onClick={() => navigate(`/drivers/${record.Driver.driverId}`)}
            >
              {record.Driver.givenName} {record.Driver.familyName}
            </div>
            <div className="driver-code">{record.Driver.code}</div>
          </div>
        ),
      },
      {
        title: TEXT.constructor,
        key: 'constructor',
        render: (_: unknown, record: Result) => (
          <span
            className="constructor-name"
            onClick={() => navigate(`/constructors/${record.Constructor.constructorId}`)}
          >
            {record.Constructor.name}
          </span>
        ),
      },
      { title: TEXT.laps, dataIndex: 'laps', key: 'laps', width: 60 },
      {
        title: TEXT.result,
        key: 'time',
        render: (_: unknown, record: Result) => record.Time?.time || record.status,
      },
      {
        title: TEXT.fastestLap,
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
        title: TEXT.points,
        dataIndex: 'points',
        key: 'points',
        width: 60,
        render: (points: string) => <span className="points">{points}</span>,
      },
    ];
  };

  if ((seasonLoading || primaryLoading) && !raceInfo) {
    return <div>{TEXT.loading}</div>;
  }

  if (!raceInfo) {
    return (
      <div className="race-detail-page">
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(-1)}
          className="back-button"
        >
          {TEXT.back}
        </Button>

        <Card>
          <p>{TEXT.notFound}</p>
        </Card>
      </div>
    );
  }

  const hasFp1 = Boolean(raceInfo?.FirstPractice) || availableDbSessions.includes('FP1') || fp1Results.length > 0;
  const hasFp2 = Boolean(raceInfo?.SecondPractice) || availableDbSessions.includes('FP2') || fp2Results.length > 0;
  const hasFp3 = Boolean(raceInfo?.ThirdPractice) || availableDbSessions.includes('FP3') || fp3Results.length > 0;
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
    hasSprintQualifying && {
      key: 'sprintQualifying',
      label: TEXT.sprintQualifying,
      data: sprintQualifyingTableData,
      columns: getQualifyingColumns(fastF1SprintQualifyingBestLapByDriver, 'SQ'),
    },
    hasSprint && { key: 'sprint', label: TEXT.sprint, data: sprintTableData, columns: getRaceColumns(sprintTableData, fastF1SprintLapByDriver) },
    {
      key: 'qualifying',
      label: TEXT.qualifying,
      data: qualifyingResults,
      columns: getQualifyingColumns(fastF1QualifyingBestLapByDriver),
    },
    { key: 'race', label: TEXT.race, data: raceResults, columns: getRaceColumns(raceResults) },
    hasFp1 && { key: 'fp1', label: TEXT.fp1, data: fp1Results, columns: getRaceColumns(fp1Results) },
    hasFp2 && { key: 'fp2', label: TEXT.fp2, data: fp2Results, columns: getRaceColumns(fp2Results) },
    hasFp3 && { key: 'fp3', label: TEXT.fp3, data: fp3Results, columns: getRaceColumns(fp3Results) },
  ].filter(Boolean) as RaceTabItem[];

  const effectiveActiveTab = tabItems.find((item) => item.key === activeTab)?.key || tabItems[0]?.key || 'sprintQualifying';
  const currentTabIndex = tabItems.findIndex((item) => item.key === effectiveActiveTab);
  const currentItem = tabItems.find((item) => item.key === effectiveActiveTab);
  const telemetrySummaryChartOption = buildRankingBarOption(
    TEXT.telemetrySummary,
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
      title: TEXT.corner,
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
      title: `${driver.driver} (${TEXT.entry}/${TEXT.minimum}/${TEXT.exit})`,
      key: `corner-${driver.driver}`,
      width: 150,
      render: (_: unknown, record: TelemetryCornerRow) =>
        formatCornerSpeedSet(record.drivers.find((item) => item.driver === driver.driver)),
    })),
  ];

  if (activeTelemetryDrivers.length === 2) {
    telemetryCornerColumns.push({
      title: `${TEXT.delta} ${TEXT.minimum}`,
      key: 'minSpeedDelta',
      width: 92,
      render: (_: unknown, record: TelemetryCornerRow) =>
        record.minSpeedDelta === null ? '-' : formatSpeed(record.minSpeedDelta),
    });
  }

  const getTableLoading = (tabKey: string, data: Array<Result | QualifyingResult>) => {
    if (seasonLoading || primaryLoading) {
      return true;
    }

    return DEFERRED_TAB_KEYS.includes(tabKey)
      && loadingSessionTabs.includes(tabKey)
      && data.length === 0;
  };

  const recentResultColumns = [
    {
      title: TEXT.time,
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
      title: TEXT.winner,
      key: 'winner',
      width: 180,
      render: (_: unknown, record: RecentGrandPrixResult) => (
        <div className="race-weekend-driver-cell">
          <strong>{record.winnerName || '-'}</strong>
          <span>{record.winnerConstructorName || '-'}</span>
        </div>
      ),
    },
    {
      title: TEXT.pole,
      key: 'pole',
      width: 160,
      render: (_: unknown, record: RecentGrandPrixResult) => (
        <div className="race-history-pole-cell">
          <strong>{record.poleName || '-'}</strong>
          {record.poleName ? <span>P1</span> : null}
        </div>
      ),
    },
    {
      title: TEXT.podium,
      key: 'podium',
      render: (_: unknown, record: RecentGrandPrixResult) => formatPodium(record),
    },
  ];

  const interruptionColumns = [
    {
      title: TEXT.raceStatus,
      dataIndex: 'label',
      key: 'label',
      width: 160,
    },
    {
      title: TEXT.probability,
      key: 'probability',
      width: 120,
      render: (_: unknown, record: TrackInterruptionProbability) => (
        <strong>{formatProbability(record.probabilityPct)}</strong>
      ),
    },
    {
      title: TEXT.sampleSize,
      key: 'sampleSize',
      width: 140,
      render: (_: unknown, record: TrackInterruptionProbability) => (
        <span>
          {record.triggeredCount}
          /
          {record.sampleSize}
          {record.status === 'insufficient-data' ? ` ${TEXT.insufficientData}` : ''}
        </span>
      ),
    },
  ];

  const interruptionSampleColumns = [
    {
      title: TEXT.season,
      key: 'season',
      width: 92,
      render: (_: unknown, record: TrackInterruptionSample) => (
        <strong>{record.season}</strong>
      ),
    },
    {
      title: TEXT.race,
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
      title: TEXT.raceStatus,
      key: 'statusTypes',
      width: 240,
      render: (_: unknown, record: TrackInterruptionSample) => (
        <div className="race-weekend-status-tags">
          {record.statusLabels.length ? record.statusLabels.map((label, index) => (
            <Tag key={`${record.season}-${record.statusTypes[index]}`} color="default">
              {label}
            </Tag>
          )) : (
            <Tag>{TEXT.noInterruption}</Tag>
          )}
        </div>
      ),
    },
  ];

  const telemetrySummaryColumns = [
    {
      title: TEXT.driver,
      key: 'driver',
      fixed: 'left' as const,
      width: 120,
      render: (_: unknown, record: DriverPostRaceTelemetrySummary) => (
        <div className="race-weekend-driver-cell">
          <strong>{record.driver}</strong>
          <span>{record.team}</span>
        </div>
      ),
    },
    {
      title: TEXT.lap,
      key: 'lapNumber',
      width: 82,
      render: (_: unknown, record: DriverPostRaceTelemetrySummary) =>
        record.lapNumber ? `L${record.lapNumber}` : '-',
    },
    {
      title: TEXT.lapTime,
      key: 'lapTimeSeconds',
      width: 110,
      render: (_: unknown, record: DriverPostRaceTelemetrySummary) =>
        formatSessionSeconds(record.lapTimeSeconds),
    },
    {
      title: TEXT.maxSpeed,
      dataIndex: 'maxSpeedKph',
      key: 'maxSpeedKph',
      width: 120,
      render: formatSpeed,
      sorter: (a: DriverPostRaceTelemetrySummary, b: DriverPostRaceTelemetrySummary) =>
        (a.maxSpeedKph || 0) - (b.maxSpeedKph || 0),
      defaultSortOrder: 'descend' as const,
    },
    {
      title: TEXT.averageSpeed,
      dataIndex: 'avgSpeedKph',
      key: 'avgSpeedKph',
      width: 120,
      render: formatSpeed,
    },
    {
      title: TEXT.fullThrottle,
      dataIndex: 'fullThrottlePct',
      key: 'fullThrottlePct',
      width: 110,
      render: formatPercent,
    },
    {
      title: TEXT.averageThrottle,
      dataIndex: 'avgThrottlePct',
      key: 'avgThrottlePct',
      width: 110,
      render: formatPercent,
    },
    {
      title: TEXT.brake,
      dataIndex: 'brakePct',
      key: 'brakePct',
      width: 90,
      render: formatPercent,
    },
    {
      title: TEXT.drs,
      dataIndex: 'drsPct',
      key: 'drsPct',
      width: 90,
      render: formatPercent,
    },
  ];

  const raceUpgradeColumns: ColumnsType<FiaRaceUpgradeTeamSummary> = [
    {
      title: TEXT.constructor,
      dataIndex: 'team',
      key: 'team',
      fixed: 'left' as const,
      width: 150,
      render: (team: string) => <strong className="upgrade-team-name">{team}</strong>,
    },
    {
      title: TEXT.upgradeTotal,
      dataIndex: 'declaredUpgradeCount',
      key: 'declaredUpgradeCount',
      width: 96,
      sorter: (a, b) => a.declaredUpgradeCount - b.declaredUpgradeCount,
    },
    {
      title: TEXT.upgradeIntensity,
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
      title: TEXT.upgradeIntent,
      key: 'dominantReason',
      width: 120,
      render: (_: unknown, record) => (
        <Tag color={record.dominantReason === 'Performance' ? 'red' : 'blue'}>
          {UPGRADE_REASON_LABELS[record.dominantReason]}
        </Tag>
      ),
    },
    {
      title: TEXT.upgradeComponents,
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
      title: TEXT.upgradeSource,
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
        title={TEXT.recentWinners}
        description={TEXT.preRaceDescription}
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
            <div className="race-weekend-empty">{TEXT.noPreviewData}</div>
          )}
        </>
      </TableOnlyPanel>

      <TableOnlyPanel
        title={TEXT.interruptionRisk}
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
                  {item.status === 'insufficient-data' ? ` ${TEXT.insufficientData}` : ''}
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
            <h4>{TEXT.sampleYears}</h4>
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
        title={<div className="data-view-title"><span>{TEXT.carUpgrades}</span><small>{TEXT.carUpgradesDescription}</small></div>}
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
          <div className="race-weekend-empty">{TEXT.carUpgradesLoadFailed}: {raceUpgradeError.message}</div>
        ) : (
          <div className="race-weekend-empty">{TEXT.noCarUpgrades}</div>
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
        {TEXT.back}
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
                  {TEXT.sprintWeekend}
                </span>
              ) : null}
            </div>
          </div>
          <p className="race-hero-circuit">
            {raceInfo.Circuit.circuitName}
            <span> — {raceInfo.Circuit.Location.locality}, {raceInfo.Circuit.Location.country}</span>
          </p>
            {weekendScheduleGroups.length ? (
              <div className="weekend-schedule" aria-label={TEXT.weekendSchedule}>
                <div className="weekend-schedule-topbar">
                  <div>
                    <span className="weekend-schedule-eyebrow">{TEXT.weekendSchedule}</span>
                    <span className="weekend-schedule-source">{TEXT.scheduleSourceHint}</span>
                  </div>
                  <span className="weekend-time-toggle" aria-label={`${TEXT.scheduleTimezone} ${TEXT.scheduleTimezoneValue}`}>
                    <ClockCircleOutlined />
                    <strong>{TEXT.scheduleTimezone}</strong>
                    {TEXT.scheduleTimezoneValue}
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
                              <span>{TEXT.scheduleTimezoneValue}</span>
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
            <span className="fastf1-eyebrow">{TEXT.raceWeekendMode}</span>
            <h2>{activeWeekendMode === 'pre' ? TEXT.preRaceOverview : TEXT.postRaceOverview}</h2>
          </div>
          <Segmented<RaceWeekendMode>
            value={activeWeekendMode}
            onChange={(value) => setSelectedWeekendMode(value)}
            options={[
              { label: TEXT.preRace, value: 'pre' },
              { label: TEXT.postRace, value: 'post' },
            ]}
          />
        </div>

        {racePreviewPanels}

        {activeWeekendMode === 'post' ? (
          <DataViewPanel
            title={TEXT.telemetrySummary}
            description={TEXT.postRaceDescription}
            className="race-weekend-post-card"
            mode={dataViewModes.telemetrySummary}
            collapsed={collapsedDataPanels.telemetrySummary}
            onModeChange={(mode) => handleDataViewModeChange('telemetrySummary', mode)}
            onToggleCollapse={() => handleDataPanelCollapseToggle('telemetrySummary')}
            chart={postRaceTelemetrySummary.length ? (
              <Suspense fallback={<div className="race-weekend-empty">{TEXT.loading}</div>}>
                <LazyEChartsPanel
                  chartKey={`post-race-telemetry-summary-${currentSeason}-${round}`}
                  height={isMobile ? 300 : 420}
                  option={telemetrySummaryChartOption}
                />
              </Suspense>
            ) : (
              <div className="race-weekend-empty">{TEXT.noTelemetrySummary}</div>
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
                  <div className="race-weekend-empty">{TEXT.noTelemetrySummary}</div>
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
              <span className="fastf1-eyebrow">{TEXT.fastF1Source}</span>
              <h2>{TEXT.fastF1Analysis}</h2>
            </div>
            {fastF1Analytics && fastF1Summary ? (
              <div className="fastf1-summary-strip" aria-label={TEXT.fastF1Analysis}>
                <span>{fastF1Summary.driverCount} {TEXT.drivers}</span>
                <span>{fastF1Summary.maxLap} {TEXT.summaryLaps}</span>
                <span>{fastF1Summary.stints} {TEXT.stints}</span>
                <span>{fastF1Summary.statusCount} {TEXT.raceStatus}</span>
                {fastF1Summary.weatherSummary ? (
                  <>
                    <span>{TEXT.trackTemp} {formatStatRange(fastF1Summary.weatherSummary.trackTempC)}</span>
                    <span>{TEXT.airTemp} {formatStatRange(fastF1Summary.weatherSummary.airTempC)}</span>
                    <span>{TEXT.humidity} {formatPercent(fastF1Summary.weatherSummary.humidityPct.average)}</span>
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
                    <span>{TEXT.race}</span>
                    <h3>{TEXT.raceAnalysisGroup}</h3>
                    <p>{TEXT.lapPaceDescription}</p>
                  </div>
                </div>
                <div className="fastf1-analytics-grid">
              {fastF1Analytics && lapPaceOption ? (
                <Card className="fastf1-chart-card">
                <div className="fastf1-chart-header">
                  <div>
                    <h3 className="fastf1-chart-title">{TEXT.lapPace}</h3>
                    <p>{TEXT.lapPaceDescription}</p>
                  </div>
                  <div className="fastf1-chart-badges">
                    {fastF1Analytics.fastestLap ? (
                      <span className="fastf1-fastest-lap-badge">
                        {TEXT.fastestLap}
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
                <div className="driver-legend" aria-label={TEXT.driver}>
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
                  <div className="track-status-legend" aria-label={TEXT.raceStatus}>
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
                <Suspense fallback={<div className="race-weekend-empty">{TEXT.loading}</div>}>
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
                    <h3 className="fastf1-chart-title">{TEXT.tyreStrategy}</h3>
                    <p>{TEXT.tyreStrategyDescription}</p>
                  </div>
                  {fastF1Summary ? (
                    <div className="compound-legend" aria-label={TEXT.tyreStrategy}>
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
                    <h3 className="fastf1-chart-title">{TEXT.driverDuel}</h3>
                    <p>{TEXT.driverDuelDescription}</p>
                  </div>
                  {duelTyreSummaryItems.length ? (
                    <div className="duel-summary-pills" aria-label={TEXT.driverDuel}>
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
                <div className="driver-legend" aria-label={TEXT.driverDuel}>
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
                          <div className="telemetry-panel-title">{TEXT.qualifying} Gap</div>
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
                          <div className="telemetry-panel-title">{TEXT.cornerSpeed}</div>
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
                                  <strong>{TEXT.delta}</strong>
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
                    {TEXT.driverDuel}: {TEXT.driver} 2
                  </div>
                )}
              </Card>
              ) : null}

              {fastF1Analytics && weatherOption && fastF1Analytics.weather ? (
                <Card className="fastf1-chart-card">
                  <div className="fastf1-chart-header">
                    <div>
                      <h3 className="fastf1-chart-title">{TEXT.weatherTrend}</h3>
                      <p>{TEXT.weatherDescription}</p>
                    </div>
                    <div className="weather-summary-pills" aria-label={TEXT.weatherTrend}>
                      <span>{TEXT.trackTemp} {formatStatRange(fastF1Analytics.weather.summary.trackTempC)}</span>
                      <span>{TEXT.airTemp} {formatStatRange(fastF1Analytics.weather.summary.airTempC)}</span>
                      <span>{TEXT.wind} {formatWindSpeed(fastF1Analytics.weather.summary.maxWindSpeedMps)}</span>
                    </div>
                  </div>
                  {fastF1Analytics.weather.summary.rainLapRanges.length ? (
                    <div className="weather-rain-legend" aria-label={TEXT.rainfall}>
                      <span className="weather-rain-swatch" />
                      <span>{TEXT.rainfall} {formatLapRanges(fastF1Analytics.weather.summary.rainLapRanges)}</span>
                    </div>
                  ) : null}
                  <Suspense fallback={<div className="race-weekend-empty">{TEXT.loading}</div>}>
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
                      <h3 className="fastf1-chart-title">{TEXT.telemetryComparison}</h3>
                      <p>{TEXT.telemetryDescription}</p>
                    </div>
                  </div>
                  <div className="telemetry-driver-strip" aria-label={TEXT.telemetryComparison}>
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
                    <Suspense fallback={<div className="race-weekend-empty">{TEXT.loading}</div>}>
                      <LazyEChartsPanel
                        chartKey={`fastf1-telemetry-speed-${currentSeason}-${round}-${activeTelemetryDrivers.map((driver) => driver.driver).join('-')}`}
                        height={isMobile ? 280 : 330}
                        option={telemetrySpeedOption}
                      />
                    </Suspense>
                  ) : null}
                  {telemetryHeatmapOption ? (
                    <div className="telemetry-heatmap-panel">
                      <div className="telemetry-panel-title">{TEXT.speedHeatmap}</div>
                      <Suspense fallback={<div className="race-weekend-empty">{TEXT.loading}</div>}>
                        <LazyEChartsPanel
                          chartKey={`fastf1-telemetry-heatmap-${currentSeason}-${round}-${activeTelemetryDrivers.map((driver) => driver.driver).join('-')}`}
                          height={isMobile ? 280 : 360}
                          option={telemetryHeatmapOption}
                        />
                      </Suspense>
                      <div className="telemetry-heat-legend" aria-label={TEXT.speedHeatmap}>
                        <span className="telemetry-heat-low" /> {TEXT.minimum}
                        <span className="telemetry-heat-high" /> {TEXT.speed}
                      </div>
                    </div>
                  ) : null}
                  {telemetryControlOption ? (
                    <>
                      <div className="telemetry-chart-divider" />
                      <div className="telemetry-metric-strip" aria-label={TEXT.telemetryComparison}>
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
                      <Suspense fallback={<div className="race-weekend-empty">{TEXT.loading}</div>}>
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
                      <div className="telemetry-panel-title">{TEXT.cornerSpeed}</div>
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
        title={<div className="data-view-title"><span>{TEXT.result}</span></div>}
        extra={(
          <div className="data-view-actions">
            <Button type="text" size="small" onClick={() => handleDataPanelCollapseToggle('raceResults')}>
              {collapsedDataPanels.raceResults ? TEXT.expand : TEXT.collapse}
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
                rowKey={(record) => record.Driver.driverId}
                pagination={false}
                loading={currentItem ? getTableLoading(currentItem.key, currentItem.data) : false}
                scroll={{ x: 'max-content' }}
                size="small"
              />
            </div>
            <div className="swipe-hint">{TEXT.mobileHint}</div>
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
                  rowKey={(record) => record.Driver.driverId}
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
