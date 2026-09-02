import type { FastF1RaceAnalytics, FastF1TelemetryDriver } from '@/types';
import { escapeTooltipText, formatNumber, formatSpeed, formatRpm } from '@/utils/raceDetailFormatters';
import { TEXT, CHART_TOOLTIP_CSS } from '../constants';
import type { ChartTooltipInput, ChartTooltipParam, TelemetryMetric } from './helpers';
import {
  hasNumericTooltipValue,
  getTelemetryMaxDistance,
  getTelemetryChartDrivers,
  getTelemetryDriverColor,
} from './helpers';

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
    data: (driver.samples?.distanceM || []).reduce<[number, number][]>((acc, d, i) => {
      const speed = driver.samples?.speedKph?.[i];
      if (Number.isFinite(d) && typeof speed === 'number' && Number.isFinite(speed)) {
        acc.push([d, speed]);
      }
      return acc;
    }, []),
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
  const distances = samples?.distanceM || [];
  const selectedMetricSet = new Set(selectedMetrics);

  const buildMetricData = (
    metric: 'throttle' | 'brake' | 'gear' | 'rpm',
    values: (number | null | boolean)[],
  ) => distances
    .map((d, i) => {
      const raw = values[i];
      const v = typeof raw === 'boolean' ? (raw ? 100 : 0) : raw;
      if (v === null || !Number.isFinite(v)) {
        return null;
      }

      return {
        value: [d, v],
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
      data: buildMetricData('throttle', samples?.throttlePct || []),
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
      data: buildMetricData('brake', samples?.brake || []),
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
      data: buildMetricData('gear', samples?.gear || []),
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
      data: buildMetricData('rpm', samples?.rpm || []),
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

function interpolateFiniteSample(
  values: (number | null | undefined)[],
  progress: number,
) {
  if (!values.length) {
    return null;
  }

  const sampleIndex = Math.max(0, Math.min(1, progress)) * (values.length - 1);
  const lowerIndex = Math.floor(sampleIndex);
  const upperIndex = Math.ceil(sampleIndex);
  const lower = values[lowerIndex];
  const upper = values[upperIndex];
  const hasLower = typeof lower === 'number' && Number.isFinite(lower);
  const hasUpper = typeof upper === 'number' && Number.isFinite(upper);

  if (hasLower && hasUpper) {
    return lower + (upper - lower) * (sampleIndex - lowerIndex);
  }
  if (hasLower) {
    return lower;
  }
  if (hasUpper) {
    return upper;
  }
  return null;
}

function buildTelemetryTrackPoints(driver: FastF1TelemetryDriver) {
  const position = driver.positionSamples;
  const xs = position?.x || [];
  const ys = position?.y || [];
  const pointCount = Math.min(xs.length, ys.length);
  const positionDistances = position?.distanceM || [];
  const positionSpeeds = position?.speedKph || [];
  const sampleDistances = driver.samples?.distanceM || [];
  const sampleSpeeds = driver.samples?.speedKph || [];

  return Array.from({ length: pointCount }, (_, index) => {
    const progress = pointCount <= 1 ? 0 : index / (pointCount - 1);
    const storedDistance = positionDistances[index];
    const storedSpeed = positionSpeeds[index];
    const distanceM = typeof storedDistance === 'number' && Number.isFinite(storedDistance)
      ? storedDistance
      : interpolateFiniteSample(sampleDistances, progress);
    const speedKph = typeof storedSpeed === 'number' && Number.isFinite(storedSpeed)
      ? storedSpeed
      : interpolateFiniteSample(sampleSpeeds, progress);

    return {
      distanceM,
      x: xs[index],
      y: ys[index],
      speedKph,
    };
  })
    .filter((point): point is {
      distanceM: number;
      x: number;
      y: number;
      speedKph: number;
    } => (
      point.distanceM !== null
      && point.speedKph !== null
      && typeof point.x === 'number'
      && Number.isFinite(point.x)
      && typeof point.y === 'number'
      && Number.isFinite(point.y)
    ))
    .sort((a, b) => a.distanceM - b.distanceM);
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

  const driverTracks = activeDrivers
    .map((driver) => ({
      driver,
      points: buildTelemetryTrackPoints(driver),
    }))
    .filter(({ points }) => points.length >= 2);
  if (!driverTracks.length) {
    return null;
  }
  const allSpeeds = driverTracks.flatMap(({ points }) => points.map((point) => point.speedKph));
  const minSpeed = allSpeeds.length ? Math.min(...allSpeeds) : 0;
  const maxSpeed = allSpeeds.length ? Math.max(...allSpeeds) : 1;
  const heatSeries = driverTracks.map(({ driver, points }) => {
    return {
      name: driver.driver,
      type: 'lines',
      coordinateSystem: 'cartesian2d',
      polyline: false,
      silent: false,
      progressive: 200,
      progressiveThreshold: 400,
      data: points.slice(0, -1).map((point, index) => {
        const next = points[index + 1];
        const speed = point.speedKph;
        return {
          coords: [
            [point.x, point.y],
            [next.x, next.y],
          ],
          driver: driver.driver,
          speedKph: speed,
          lineStyle: {
            color: speedHeatColor(speed, minSpeed, maxSpeed),
          },
        };
      }),
      lineStyle: {
        width: activeDrivers.length > 1 ? 2.4 : 3.2,
        opacity: activeDrivers.length > 1 ? 0.72 : 0.92,
      },
      emphasis: {
        lineStyle: {
          width: 4,
          opacity: 1,
        },
      },
    };
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

export {
  buildTelemetryCornerMarkLines,
  buildTelemetrySpeedTooltip,
  buildTelemetryControlTooltip,
  buildTelemetrySpeedOption,
  buildTelemetryControlSeries,
  buildTelemetryControlOption,
  speedHeatColor,
  buildTrackHeatTooltip,
  buildTrackHeatCornerSeries,
  buildTelemetryHeatmapOption,
};
