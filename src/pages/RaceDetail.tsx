import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Table, Tabs, Tag } from 'antd';
import { ArrowLeftOutlined, FlagOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { seasonApi } from '@/api/ergast';
import EChartsPanel from '@/components/charts/EChartsPanel';
import { useFastF1RaceAnalytics, useFastF1SessionAnalytics, useSeasonData } from '@/hooks';
import { useAppStore } from '@/store';
import type {
  FastF1DriverLapSeries,
  FastF1CornerAnalysis,
  FastF1QualifyingBestLap,
  FastF1RaceAnalytics,
  FastF1StrategyStint,
  FastF1TelemetryDriver,
  FastF1TelemetrySample,
  FastF1TrackStatusPeriod,
  FastF1WeatherLapRange,
  FastF1WeatherPoint,
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

type TelemetryMetric = 'throttle' | 'brake' | 'gear' | 'rpm';

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
  weatherDescription: '\u5c06\u8d5b\u9053\u6e29\u5ea6\u3001\u6c14\u6e29\u3001\u6e7f\u5ea6\u548c\u964d\u96e8\u6620\u5c04\u5230\u5708\u6570\uff0c\u7528\u4e8e\u89e3\u91ca\u5708\u901f\u548c\u8f6e\u80ce\u8868\u73b0\u53d8\u5316\u3002',
  raceStatus: '\u8d5b\u9053\u72b6\u6001',
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

function formatNumber(value: number | null | undefined, decimals = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '-';
  }

  return value.toFixed(decimals);
}

function formatTemperature(value: number | null | undefined) {
  const formatted = formatNumber(value, 1);
  return formatted === '-' ? formatted : `${formatted} C`;
}

function formatPercent(value: number | null | undefined) {
  const formatted = formatNumber(value, 0);
  return formatted === '-' ? formatted : `${formatted}%`;
}

function formatWindSpeed(value: number | null | undefined) {
  const formatted = formatNumber(value, 1);
  return formatted === '-' ? formatted : `${formatted} m/s`;
}

function formatSpeed(value: number | null | undefined) {
  const formatted = formatNumber(value, 1);
  return formatted === '-' ? formatted : `${formatted} km/h`;
}

function formatRpm(value: number | null | undefined) {
  const formatted = formatNumber(value, 0);
  return formatted === '-' ? formatted : `${formatted} rpm`;
}

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

function buildWeatherTooltip(params: any[] | any) {
  const tooltipItems = Array.isArray(params) ? params : [params];
  const point = tooltipItems.find((param) => param.data?.weather)?.data?.weather;

  if (!point) {
    return '';
  }

  const rows = tooltipItems
    .filter((param) => Number.isFinite(param.value?.[1]))
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
      formatter: (param: any) => param.name,
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

function buildTelemetrySpeedTooltip(params: any[] | any) {
  const tooltipItems = (Array.isArray(params) ? params : [params])
    .filter((param) => Number.isFinite(param.value?.[1]));

  if (!tooltipItems.length) {
    return '';
  }

  const distance = tooltipItems[0]?.value?.[0] ?? '-';
  const rows = tooltipItems.map((param) => `\n    <div class="fastf1-tooltip-row">\n      <span class="fastf1-tooltip-marker" style="background:${param.color};"></span>\n      <span class="fastf1-tooltip-name">${escapeTooltipText(param.seriesName)}</span>\n      <strong>${formatSpeed(param.value[1])}</strong>\n    </div>\n  `).join('');

  return `\n    <div class="fastf1-tooltip">\n      <div class="fastf1-tooltip-title">${TEXT.speed} ${formatNumber(distance, 0)} m</div>\n      <div class="fastf1-tooltip-grid">${rows}</div>\n    </div>\n  `;
}

function buildTelemetryControlTooltip(params: any[] | any) {
  const tooltipItems = (Array.isArray(params) ? params : [params])
    .filter((param) => Number.isFinite(param.value?.[1]));

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

function buildTrackHeatTooltip(params: any) {
  const data = params?.data;
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
      formatter: (param: any) => param.data?.label || '',
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

const RaceDetail = () => {
  const { round } = useParams<{ round: string }>();
  const navigate = useNavigate();
  const { currentSeason } = useAppStore();
  const { races, loading: seasonLoading } = useSeasonData(currentSeason);
  const {
    data: fastF1Analytics,
    loading: fastF1AnalyticsLoading,
  } = useFastF1RaceAnalytics(currentSeason, round);
  const {
    data: fastF1QualifyingAnalytics,
  } = useFastF1SessionAnalytics(currentSeason, round, 'Q');
  const {
    data: fastF1SprintQualifyingAnalytics,
  } = useFastF1SessionAnalytics(currentSeason, round, 'SQ');
  const {
    data: fastF1SprintShootoutAnalytics,
  } = useFastF1SessionAnalytics(currentSeason, round, 'SS');

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
  const [selectedTelemetryDrivers, setSelectedTelemetryDrivers] = useState<string[]>([]);
  const [selectedTelemetryMetrics, setSelectedTelemetryMetrics] = useState<TelemetryMetric[]>(
    TELEMETRY_METRICS.map((metric) => metric.key),
  );

  const raceInfo = races.find((race) => race.round === round) || null;
  const lapPaceOption = useMemo(
    () => (fastF1Analytics ? buildLapPaceOption(fastF1Analytics, selectedLapDrivers) : null),
    [fastF1Analytics, selectedLapDrivers],
  );
  const tyreStrategyOption = useMemo(
    () => (fastF1Analytics ? buildTyreStrategyOption(fastF1Analytics) : null),
    [fastF1Analytics],
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
  const driverLegendItems = useMemo(
    () => getDriverLegendItems(fastF1Analytics?.lapTimeSeries || []),
    [fastF1Analytics],
  );
  const fastF1QualifyingBestLapByDriver = useMemo(
    () => getBestLapByDriver(fastF1QualifyingAnalytics),
    [fastF1QualifyingAnalytics],
  );
  const fastF1SprintQualifyingBestLapByDriver = useMemo(
    () => getBestLapByDriver(fastF1SprintQualifyingAnalytics || fastF1SprintShootoutAnalytics),
    [fastF1SprintQualifyingAnalytics, fastF1SprintShootoutAnalytics],
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
    setSelectedTelemetryDrivers([]);
    setSelectedTelemetryMetrics(TELEMETRY_METRICS.map((metric) => metric.key));
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

  const getQualifyingColumns = (
    bestLapByDriver: Map<string, FastF1QualifyingBestLap>,
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
      {
        title: TEXT.sector1,
        key: 'fastf1S1',
        width: 80,
        render: (_: unknown, record: QualifyingResult) =>
          formatSessionSeconds(bestLapByDriver.get(record.Driver.code)?.sector1Seconds),
      },
      {
        title: TEXT.sector2,
        key: 'fastf1S2',
        width: 80,
        render: (_: unknown, record: QualifyingResult) =>
          formatSessionSeconds(bestLapByDriver.get(record.Driver.code)?.sector2Seconds),
      },
      {
        title: TEXT.sector3,
        key: 'fastf1S3',
        width: 80,
        render: (_: unknown, record: QualifyingResult) =>
          formatSessionSeconds(bestLapByDriver.get(record.Driver.code)?.sector3Seconds),
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
      { title: 'Q1', dataIndex: 'Q1', key: 'Q1', width: 80 },
      { title: 'Q2', dataIndex: 'Q2', key: 'Q2', width: 80 },
      { title: 'Q3', dataIndex: 'Q3', key: 'Q3', width: 80 },
      ...fastF1Columns,
    ];
  };

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
    {
      key: 'qualifying',
      label: TEXT.qualifying,
      data: qualifyingResults,
      columns: getQualifyingColumns(fastF1QualifyingBestLapByDriver),
    },
    hasSprintQualifying && {
      key: 'sprintQualifying',
      label: TEXT.sprintQualifying,
      data: sprintQualifyingResults,
      columns: getQualifyingColumns(fastF1SprintQualifyingBestLapByDriver),
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

  const telemetryCornerColumns = [
    {
      title: TEXT.corner,
      key: 'corner',
      fixed: 'left' as const,
      width: 86,
      render: (_: unknown, record: ReturnType<typeof getCornerSpeedRows>[number]) => (
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
      render: (_: unknown, record: ReturnType<typeof getCornerSpeedRows>[number]) =>
        formatCornerSpeedSet(record.drivers.find((item) => item.driver === driver.driver)),
    })),
    activeTelemetryDrivers.length === 2 ? {
      title: `${TEXT.delta} ${TEXT.minimum}`,
      key: 'minSpeedDelta',
      width: 92,
      render: (_: unknown, record: ReturnType<typeof getCornerSpeedRows>[number]) =>
        record.minSpeedDelta === null ? '-' : formatSpeed(record.minSpeedDelta),
    } : null,
  ].filter(Boolean) as any[];

  const getTableLoading = (tabKey: string, data: Array<Result | QualifyingResult>) => {
    if (seasonLoading || primaryLoading) {
      return true;
    }

    return DEFERRED_TAB_KEYS.includes(tabKey) && sessionsLoading && data.length === 0;
  };

  const shouldShowFastF1Section = Boolean(fastF1AnalyticsLoading || fastF1Analytics);

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

              {weatherOption && fastF1Analytics.weather ? (
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
                  <EChartsPanel
                    chartKey={`fastf1-weather-${currentSeason}-${round}`}
                    height={isMobile ? 300 : 360}
                    option={weatherOption}
                  />
                </Card>
              ) : null}

              {fastF1Analytics.telemetry ? (
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
                    <EChartsPanel
                      chartKey={`fastf1-telemetry-speed-${currentSeason}-${round}-${activeTelemetryDrivers.map((driver) => driver.driver).join('-')}`}
                      height={isMobile ? 280 : 330}
                      option={telemetrySpeedOption}
                    />
                  ) : null}
                  {telemetryHeatmapOption ? (
                    <div className="telemetry-heatmap-panel">
                      <div className="telemetry-panel-title">{TEXT.speedHeatmap}</div>
                      <EChartsPanel
                        chartKey={`fastf1-telemetry-heatmap-${currentSeason}-${round}-${activeTelemetryDrivers.map((driver) => driver.driver).join('-')}`}
                        height={isMobile ? 280 : 360}
                        option={telemetryHeatmapOption}
                      />
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
                      <EChartsPanel
                        chartKey={`fastf1-telemetry-controls-${currentSeason}-${round}-${activeTelemetryDrivers.map((driver) => driver.driver).join('-')}-${selectedTelemetryMetrics.join('-')}`}
                        height={isMobile ? 300 : 340}
                        option={telemetryControlOption}
                      />
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
