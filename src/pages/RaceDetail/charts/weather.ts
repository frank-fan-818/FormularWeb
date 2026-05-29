import type { FastF1RaceAnalytics, FastF1WeatherLapRange, FastF1WeatherPoint } from '@/types';
import { escapeTooltipText, formatPercent, formatTemperature, formatWindSpeed } from '@/utils/raceDetailFormatters';
import { TEXT, WEATHER_COLORS, CHART_TOOLTIP_CSS } from '../constants';
import type { ChartTooltipInput } from './helpers';
import { hasNumericTooltipValue, getMaxRaceLap } from './helpers';

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

export { buildWeatherMarkArea, buildWeatherTooltip, averageNullable, aggregateWeatherPointsByLap, buildWeatherOption };
