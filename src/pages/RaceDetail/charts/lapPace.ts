import type { FastF1RaceAnalytics, FastF1TrackStatusPeriod } from '@/types';
import { escapeTooltipText, formatSeconds } from '@/utils/raceDetailFormatters';
import { TEXT, DRIVER_COLORS, TRACK_STATUS_STYLES, CHART_TOOLTIP_CSS } from '../constants';
import type { ChartTooltipInput } from './helpers';
import { hasNumericTooltipValue, getDriverColor, getMaxRaceLap } from './helpers';

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
            formatter: `${TEXT.fastestLap} \u8def ${fastestLap.driver}`,
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

export { buildLapPaceTooltip, buildTrackStatusMarkArea, buildLapPaceOption };
