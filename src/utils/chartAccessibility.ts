import type { ChartTablePage } from '@/types/chartAccessibility';

const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};

function axisAt(value: unknown, index: unknown): Record<string, unknown> {
  return record(Array.isArray(value) ? value[typeof index === 'number' ? index : 0] : value);
}

function formatCell(value: unknown, axis: Record<string, unknown>): string {
  if (value === null || value === undefined || typeof value === 'number' && !Number.isFinite(value)) return '—';
  if (axis.type === 'category' && Array.isArray(axis.data) && typeof value === 'number') value = axis.data[value] ?? value;
  if (typeof value !== 'number' && typeof value !== 'string') return '—';
  const formatter = record(axis.axisLabel).formatter;
  try {
    if (typeof formatter === 'function') {
      const result: unknown = formatter(value);
      if (typeof result === 'string' || typeof result === 'number') return String(result);
    }
    if (typeof formatter === 'string') return formatter.split('{value}').join(String(value));
  } catch { /* A presentation formatter must not hide accessible raw data. */ }
  return String(value);
}

export function getChartTablePage(option: unknown, selectedSeries = 0, selectedPage = 0): ChartTablePage {
  const root = record(option);
  const candidates = Array.isArray(root.series) ? root.series : root.series ? [root.series] : [];
  const series = candidates.map(record).filter(item => ['line', 'bar', 'scatter'].includes(String(item.type)) && Array.isArray(item.data) && item.data.length > 0);
  const seriesIndex = Math.max(0, Math.min(Math.floor(selectedSeries), Math.max(0, series.length - 1)));
  const current = series[seriesIndex] ?? {};
  const points: unknown[] = Array.isArray(current.data) ? current.data : [];
  const pageCount = Math.ceil(points.length / 20);
  const pageIndex = Math.max(0, Math.min(Math.floor(selectedPage), Math.max(0, pageCount - 1)));
  const x = axisAt(root.xAxis, current.xAxisIndex);
  const y = axisAt(root.yAxis, current.yAxisIndex);
  return {
    seriesNames: series.map((item, index) => typeof item.name === 'string' ? item.name : `Series ${index + 1}`),
    seriesIndex,
    labels: [typeof x.name === 'string' ? x.name : 'X', typeof y.name === 'string' ? y.name : 'Y'],
    total: points.length,
    pageIndex,
    pageCount,
    rows: points.slice(pageIndex * 20, (pageIndex + 1) * 20).map((point, offset) => {
      const index = pageIndex * 20 + offset;
      const value = point !== null && typeof point === 'object' && !Array.isArray(point) ? record(point).value : point;
      const [xValue, yValue] = Array.isArray(value) ? value : y.type === 'category'
        ? [value, index] : [x.type === 'category' ? index : index + 1, value];
      return [formatCell(xValue, x), formatCell(yValue, y)];
    }),
  };
}
