import { describe, expect, it } from 'vitest';
import { buildComparisonRows, formatPointsGap, getComparisonChartOption } from './pointsComparison';
import type { SeasonPointsProgress } from '@/types/pointsComparison';

const progress: SeasonPointsProgress = {
  latest: { round: 3, points: { a: 53.5, b: 50 } },
  rounds: [
    { round: 1, name: '<Australia>', snapshot: { round: 1, points: { a: 25 } } },
    { round: 2, name: 'China', snapshot: null },
    { round: 3, name: 'Japan', snapshot: { round: 3, points: { a: 53.5, b: 50 } } },
  ],
};
const a = { id: 'a', name: '<A>', color: '#00aaaa' };
const b = { id: 'b', name: 'B', color: '#00aaaa' };

describe('points comparison', () => {
  it('aligns official snapshots and distinguishes missing snapshots from absent entrants', () => {
    expect(buildComparisonRows(progress, 'a', 'b')).toEqual([
      { round: 1, name: '<Australia>', own: 25, opponent: 0, gap: 25 },
      { round: 2, name: 'China', own: null, opponent: null, gap: null },
      { round: 3, name: 'Japan', own: 53.5, opponent: 50, gap: 3.5 },
    ]);
  });
  it('formats lead, deficit and ties without losing fractional points', () => {
    expect(formatPointsGap(3.5)).toBe('领先 3.5 分');
    expect(formatPointsGap(-2)).toBe('落后 2 分');
    expect(formatPointsGap(0)).toBe('积分持平');
    expect(formatPointsGap(null)).toBe('暂无差距数据');
  });
  it('preserves gaps, differentiates teammates and escapes tooltip content', () => {
    const option = getComparisonChartOption({ grid: { containLabel: true } }, progress, a, b);
    expect(option.series).toHaveLength(2);
    expect(option.series[0].data).toEqual([25, null, 53.5]);
    expect(option.series[1].data).toEqual([0, null, 50]);
    expect(option.series[0].lineStyle.color).not.toBe(option.series[1].lineStyle.color);
    expect(option.series[0].connectNulls).toBe(false);
    const html = option.tooltip.formatter({ dataIndex: 0 });
    expect(html).toContain('&lt;Australia&gt;');
    expect(html).toContain('&lt;A&gt;');
    expect(html).toContain('领先 25 分');
    expect(html).not.toContain('<A>');
  });
});
