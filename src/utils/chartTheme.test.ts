import { describe, expect, it } from 'vitest';
import { applyChartTextTheme } from './chartTheme';

describe('chart text theme', () => {
  it('updates every axis and legend without changing units, data or driver/status colors', () => {
    const formatter = (value: number) => `${value}%`;
    const series = [{ type: 'line', data: [1, 2], itemStyle: { color: '#ff1801' } }];
    const option = { xAxis: { axisLabel: { color: '#64748b' } },
      yAxis: [{ axisLabel: { formatter, color: '#64748b' } }, { name: '%' }],
      legend: { textStyle: { fontSize: 12 } }, series };
    expect(applyChartTextTheme(option, '#e2e8f0', '#94a3b8')).toMatchObject({
      xAxis: { axisLabel: { color: '#94a3b8', hideOverlap: true } },
      yAxis: [{ axisLabel: { formatter, color: '#94a3b8' } }, { nameTextStyle: { color: '#94a3b8' } }],
      legend: { textStyle: { color: '#e2e8f0', fontSize: 12 } }, series,
    });
    expect(option.xAxis.axisLabel.color).toBe('#64748b');
  });
  it('preserves intentionally fixed dark ranking surfaces in either UI theme', () => {
    const option = { backgroundColor: '#050505', xAxis: { axisLabel: { color: '#f4f4f5' } } };
    expect(applyChartTextTheme(option, '#222222', '#717171')).toBe(option);
  });
});
