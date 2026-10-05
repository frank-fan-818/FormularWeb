import { describe, expect, it } from 'vitest';
import { getChartTablePage } from './chartAccessibility';

describe('chart data alternative', () => {
  it('maps category line values to their real labels and formats their units', () => {
    const page = getChartTablePage({ xAxis: { name: 'Lap', type: 'category', data: ['L1', 'L2'] },
      yAxis: { name: 'Time', axisLabel: { formatter: '{value}s' } },
      series: [{ name: 'VER', type: 'line', data: [90, 88.5] }] });
    expect(page.rows).toEqual([['L1', '90s'], ['L2', '88.5s']]);
    expect(page.labels).toEqual(['Lap', 'Time']);
  });
  it('keeps value-coordinate line data and chooses the correct secondary axis', () => {
    const page = getChartTablePage({ xAxis: { name: 'Distance (m)' },
      yAxis: [{ name: 'Speed' }, { name: 'Throttle', axisLabel: { formatter: '{value}%' } }],
      series: [{ name: 'VER throttle', type: 'line', yAxisIndex: 1, data: [{ value: [100, 85] }] }] });
    expect(page.labels).toEqual(['Distance (m)', 'Throttle']);
    expect(page.rows).toEqual([['100', '85%']]);
  });
  it('maps horizontal bars to drivers instead of labelling their lap count as a driver index', () => {
    const page = getChartTablePage({ xAxis: { name: 'Laps' }, yAxis: { type: 'category', data: ['VER', 'HAM'] },
      series: [{ name: 'Stint 1', type: 'bar', data: [{ value: 10 }, { value: 12 }] }] });
    expect(page.rows).toEqual([['10', 'VER'], ['12', 'HAM']]);
  });
  it('exposes every point through bounded pages, including the final partial page', () => {
    const option = { series: [{ type: 'scatter', name: 'Speed', data: Array.from({ length: 43 }, (_, n) => [n, n * 10]) }] };
    expect(getChartTablePage(option).rows).toHaveLength(20);
    const last = getChartTablePage(option, 0, 2);
    expect(last.total).toBe(43);
    expect(last.pageCount).toBe(3);
    expect(last.rows).toEqual([['40', '400'], ['41', '410'], ['42', '420']]);
  });
  it('allows selection of another driver series and clamps stale pagination after a filter changes', () => {
    const page = getChartTablePage({ series: [{ type: 'line', name: 'VER', data: [1, 2] },
      { type: 'line', name: 'HAM', data: [3] }] }, 1, 5);
    expect(page.seriesNames).toEqual(['VER', 'HAM']);
    expect(page.pageIndex).toBe(0);
    expect(page.rows).toEqual([['1', '3']]);
  });
  it('uses a dash for missing and non-finite measurements without dropping the point', () => {
    expect(getChartTablePage({ series: [{ type: 'line', data: [null, NaN, Infinity] }] }).rows)
      .toEqual([['1', '—'], ['2', '—'], ['3', '—']]);
  });
  it('ignores geometric lines rather than inventing numeric measurements for the track shape', () => {
    expect(getChartTablePage({ series: [{ type: 'lines', data: [{ coords: [[1, 2], [3, 4]] }] }] }).total).toBe(0);
  });
  it('returns an empty result for absent or unsupported data', () => {
    expect(getChartTablePage(null).rows).toEqual([]);
    expect(getChartTablePage({ series: [{ type: 'custom', data: [1] }] }).rows).toEqual([]);
  });
  it('keeps populated series available when the first driver has no measurements', () => {
    expect(getChartTablePage({ series: [{ type: 'line', name: 'NOR', data: [] },
      { type: 'line', name: 'HAM', data: [90] }] }).seriesNames).toEqual(['HAM']);
  });
  it('uses trusted axis formatters without executing text and tolerates a broken formatter', () => {
    const page = getChartTablePage({ yAxis: { axisLabel: { formatter: () => { throw new Error('invalid'); } } },
      series: [{ type: 'line', name: '<img src=x>', data: [5] }] });
    expect(page.rows).toEqual([['1', '5']]);
    expect(page.seriesNames).toEqual(['<img src=x>']);
  });
});
