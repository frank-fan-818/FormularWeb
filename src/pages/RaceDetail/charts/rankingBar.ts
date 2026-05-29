import type { DriverPostRaceTelemetrySummary } from '@/types';
import { escapeTooltipText, formatNumber } from '@/utils/raceDetailFormatters';
import { DRIVER_COLORS, CHART_TOOLTIP_CSS } from '../constants';
import type { RankingChartRow, ChartTooltipInput } from './helpers';

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

export { buildRankingBarOption, getTelemetrySummaryChartRows };
