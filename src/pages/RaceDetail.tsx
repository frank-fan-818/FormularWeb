import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Table, Tabs, Tag } from 'antd';
import { ArrowLeftOutlined, FlagOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { seasonApi } from '@/api/ergast';
import EChartsPanel from '@/components/charts/EChartsPanel';
import { useFastF1RaceAnalytics, useSeasonData } from '@/hooks';
import { useAppStore } from '@/store';
import type {
  FastF1DriverLapSeries,
  FastF1RaceAnalytics,
  FastF1StrategyStint,
  FastF1TrackStatusPeriod,
  QualifyingResult,
  Result,
} from '@/types';
import './RaceDetail.css';

interface RaceTabItem {
  key: string;
  label: string;
  data: Array<Result | QualifyingResult>;
  columns: any[];
}

const DEFERRED_TAB_KEYS = ['fp1', 'fp2', 'fp3', 'sprintQualifying', 'sprint'];

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
  mobileHint: '\u70b9\u51fb\u4e0a\u65b9\u5706\u70b9\u5207\u6362\u4f1a\u8bdd',
  fp1: '\u7ec3\u4e60\u8d5b 1',
  fp2: '\u7ec3\u4e60\u8d5b 2',
  fp3: '\u7ec3\u4e60\u8d5b 3',
  qualifying: '\u6392\u4f4d\u8d5b',
  sprintQualifying: '\u51b2\u523a\u6392\u4f4d\u8d5b',
  sprint: '\u51b2\u523a\u8d5b',
  race: '\u6b63\u8d5b',
  fastF1Analysis: 'FastF1 \u6bd4\u8d5b\u5206\u6790',
  lapPace: '\u5708\u901f\u8d70\u52bf',
  tyreStrategy: '\u8f6e\u80ce\u7b56\u7565',
  fastF1Source: '\u79bb\u7ebf\u6570\u636e',
  drivers: '\u8f66\u624b',
  summaryLaps: '\u5708',
  stints: '\u6bb5\u8f6e\u80ce',
  lapPaceDescription: '\u9010\u5708\u5bf9\u6bd4\u6b63\u8d5b\u8282\u594f\uff0c\u53ef\u5feb\u901f\u770b\u5230\u957f\u8ddd\u79bb\u901f\u5ea6\u8870\u51cf\u548c\u5b89\u5168\u8f66\u5f71\u54cd\u3002',
  tyreStrategyDescription: '\u6309\u8f66\u624b\u62c6\u5206 stint \u548c compound\uff0c\u5c55\u793a\u6bcf\u6bb5\u8f6e\u80ce\u7684\u5708\u6570\u548c\u6362\u80ce\u8282\u70b9\u3002',
  raceStatus: '\u8d5b\u9053\u72b6\u6001',
};

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

function escapeTooltipText(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatSeconds(value: number) {
  if (!Number.isFinite(value)) {
    return '-';
  }

  const minutes = Math.floor(value / 60);
  const seconds = value - minutes * 60;
  return `${minutes}:${seconds.toFixed(3).padStart(6, '0')}`;
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

function buildLapPaceTooltip(params: any[] | any) {
  const tooltipItems = (Array.isArray(params) ? params : [params])
    .filter((param) => Number.isFinite(param.value?.[1]))
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
            formatter: `${TEXT.fastestLap} · ${fastestLap.driver}`,
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

function getStintAtIndex(stints: FastF1StrategyStint[], index: number) {
  return stints.find((stint) => stint.stint === index + 1) || null;
}

function buildTyreStrategyOption(analytics: FastF1RaceAnalytics) {
  const strategies = [...analytics.tyreStrategies].sort((a, b) => {
    const aPosition = a.racePosition ?? Number.MAX_SAFE_INTEGER;
    const bPosition = b.racePosition ?? Number.MAX_SAFE_INTEGER;
    return aPosition - bPosition;
  });
  const drivers = strategies.map((strategy) => strategy.driver);
  const maxStints = Math.max(
    0,
    ...strategies.map((strategy) => strategy.stints.length),
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
      formatter: (params: any) => {
        const data = params.data as { stint?: FastF1StrategyStint };
        const stint = data?.stint;
        if (!stint) {
          return '';
        }

        return `${params.name}<br/>${stint.compound}: L${stint.startLap}-L${stint.endLap} (${stint.lapCount})`;
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
      data: strategies.map((strategy) => {
        const stint = getStintAtIndex(strategy.stints, index);
        return {
          value: stint?.lapCount || 0,
          stint: stint || undefined,
          itemStyle: {
            color: stint ? getCompoundColor(stint.compound) : 'transparent',
            borderColor: 'rgba(15, 23, 42, 0.3)',
            borderWidth: stint ? 1 : 0,
          },
        };
      }),
    })),
  };
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
  };
}

function getDriverLegendItems(series: FastF1DriverLapSeries[]) {
  return series.map((item, index) => ({
    driver: item.driver,
    color: getDriverColor(index),
  }));
}

const RaceDetail = () => {
  const { round } = useParams<{ round: string }>();
  const navigate = useNavigate();
  const { currentSeason } = useAppStore();
  const { races, loading: seasonLoading } = useSeasonData(currentSeason);
  const {
    data: fastF1Analytics,
    loading: fastF1AnalyticsLoading,
  } = useFastF1RaceAnalytics(currentSeason, round);

  const [qualifyingResults, setQualifyingResults] = useState<QualifyingResult[]>([]);
  const [raceResults, setRaceResults] = useState<Result[]>([]);
  const [sprintResults, setSprintResults] = useState<Result[]>([]);
  const [sprintQualifyingResults, setSprintQualifyingResults] = useState<QualifyingResult[]>([]);
  const [fp1Results, setFp1Results] = useState<Result[]>([]);
  const [fp2Results, setFp2Results] = useState<Result[]>([]);
  const [fp3Results, setFp3Results] = useState<Result[]>([]);
  const [primaryLoading, setPrimaryLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('qualifying');
  const [isMobile, setIsMobile] = useState(false);
  const [selectedLapDrivers, setSelectedLapDrivers] = useState<string[]>([]);

  const raceInfo = races.find((race) => race.round === round) || null;
  const lapPaceOption = useMemo(
    () => (fastF1Analytics ? buildLapPaceOption(fastF1Analytics, selectedLapDrivers) : null),
    [fastF1Analytics, selectedLapDrivers],
  );
  const tyreStrategyOption = useMemo(
    () => (fastF1Analytics ? buildTyreStrategyOption(fastF1Analytics) : null),
    [fastF1Analytics],
  );
  const fastF1Summary = useMemo(
    () => buildFastF1Summary(fastF1Analytics),
    [fastF1Analytics],
  );
  const driverLegendItems = useMemo(
    () => getDriverLegendItems(fastF1Analytics?.lapTimeSeries || []),
    [fastF1Analytics],
  );
  const hasLapDriverFilter = selectedLapDrivers.length > 0;

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
    if (!round) {
      return;
    }

    let cancelled = false;

    setSprintResults([]);
    setSprintQualifyingResults([]);
    setFp1Results([]);
    setFp2Results([]);
    setFp3Results([]);
    setSessionsLoading(true);

    const loadDeferredSessions = async () => {
      const [sprintData, sprintQualifyingData, fp1Data, fp2Data, fp3Data] = await Promise.allSettled([
        seasonApi.getSprintResults(currentSeason, round),
        seasonApi.getSprintQualifyingResults(currentSeason, round),
        seasonApi.getPracticeResults(currentSeason, round, 1),
        seasonApi.getPracticeResults(currentSeason, round, 2),
        seasonApi.getPracticeResults(currentSeason, round, 3),
      ]);

      if (cancelled) {
        return;
      }

      setSprintResults(sprintData.status === 'fulfilled' ? sprintData.value?.Results || [] : []);
      setSprintQualifyingResults(
        sprintQualifyingData.status === 'fulfilled' ? sprintQualifyingData.value?.QualifyingResults || [] : [],
      );
      setFp1Results(fp1Data.status === 'fulfilled' ? fp1Data.value?.Results || [] : []);
      setFp2Results(fp2Data.status === 'fulfilled' ? fp2Data.value?.Results || [] : []);
      setFp3Results(fp3Data.status === 'fulfilled' ? fp3Data.value?.Results || [] : []);
      setSessionsLoading(false);
    };

    void loadDeferredSessions();

    return () => {
      cancelled = true;
    };
  }, [currentSeason, round]);

  const qualifyingColumns = [
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
    { title: 'Q1', dataIndex: 'Q1', key: 'Q1', width: 80 },
    { title: 'Q2', dataIndex: 'Q2', key: 'Q2', width: 80 },
    { title: 'Q3', dataIndex: 'Q3', key: 'Q3', width: 80 },
  ];

  const getRaceColumns = (data: Result[]) => {
    let fastestLapTime = '';
    data.forEach((result) => {
      if (result.FastestLap?.Time?.time) {
        if (!fastestLapTime || result.FastestLap.Time.time < fastestLapTime) {
          fastestLapTime = result.FastestLap.Time.time;
        }
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
          const time = record.FastestLap?.Time?.time;
          if (!time) {
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

  const hasFp1 = fp1Results.length > 0;
  const hasFp2 = fp2Results.length > 0;
  const hasFp3 = fp3Results.length > 0;
  const hasSprintQualifying = sprintQualifyingResults.length > 0;
  const hasSprint = sprintResults.length > 0;
  const isSprintWeekend = hasSprint || hasSprintQualifying;

  const tabItems: RaceTabItem[] = [
    hasFp1 && { key: 'fp1', label: TEXT.fp1, data: fp1Results, columns: getRaceColumns(fp1Results) },
    hasFp2 && { key: 'fp2', label: TEXT.fp2, data: fp2Results, columns: getRaceColumns(fp2Results) },
    hasFp3 && { key: 'fp3', label: TEXT.fp3, data: fp3Results, columns: getRaceColumns(fp3Results) },
    { key: 'qualifying', label: TEXT.qualifying, data: qualifyingResults, columns: qualifyingColumns },
    hasSprintQualifying && {
      key: 'sprintQualifying',
      label: TEXT.sprintQualifying,
      data: sprintQualifyingResults,
      columns: qualifyingColumns,
    },
    hasSprint && { key: 'sprint', label: TEXT.sprint, data: sprintResults, columns: getRaceColumns(sprintResults) },
    { key: 'race', label: TEXT.race, data: raceResults, columns: getRaceColumns(raceResults) },
  ].filter(Boolean) as RaceTabItem[];

  const effectiveActiveTab = tabItems.find((item) => item.key === activeTab)?.key || tabItems[0]?.key || 'qualifying';
  const currentTabIndex = tabItems.findIndex((item) => item.key === effectiveActiveTab);
  const currentItem = tabItems.find((item) => item.key === effectiveActiveTab);

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

  const getTableLoading = (tabKey: string, data: Array<Result | QualifyingResult>) => {
    if (seasonLoading || primaryLoading) {
      return true;
    }

    return DEFERRED_TAB_KEYS.includes(tabKey) && sessionsLoading && data.length === 0;
  };

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
        <div className="race-header">
          <div>
            <h1 className="race-title">
              <FlagOutlined className="race-flag-icon" />
              {raceInfo.raceName}
            </h1>
            <p className="race-circuit">
              {raceInfo.Circuit.circuitName}
              {' - '}
              {raceInfo.Circuit.Location.locality}, {raceInfo.Circuit.Location.country}
            </p>
            <Tag color="blue" className="race-date">
              {dayjs(raceInfo.date).format('YYYY-MM-DD')}
            </Tag>
            {isSprintWeekend ? (
              <Tag color="orange" className="sprint-tag">
                {TEXT.sprintWeekend}
              </Tag>
            ) : null}
          </div>
        </div>
      </Card>

      {(fastF1AnalyticsLoading || fastF1Analytics) ? (
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
              </div>
            ) : null}
          </div>

          {fastF1Analytics && lapPaceOption && tyreStrategyOption ? (
            <div className="fastf1-analytics-grid">
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
                <EChartsPanel
                  chartKey={`fastf1-laps-${currentSeason}-${round}`}
                  height={isMobile ? 300 : 430}
                  option={lapPaceOption}
                />
              </Card>

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
                          {compound}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <EChartsPanel
                  chartKey={`fastf1-strategy-${currentSeason}-${round}`}
                  height={isMobile ? 300 : 430}
                  option={tyreStrategyOption}
                />
              </Card>
            </div>
          ) : null}
        </section>
      ) : null}

      <Card className="results-card">
        {isMobile ? (
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
