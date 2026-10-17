import type { PointsComparisonEntry, SeasonPointsProgress } from '@/types/pointsComparison';
import { escapeHtml } from './chartTooltip';
import { getTeamColor } from './teamColors';

export function formatPointsValue(value: number): string {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 3 }).format(value);
}

export function formatPointsGap(gap: number | null): string {
  if (gap === null) return '暂无差距数据';
  if (Math.abs(gap) < 0.000001) return '积分持平';
  return `${gap > 0 ? '领先' : '落后'} ${formatPointsValue(Math.abs(gap))} 分`;
}

export function buildComparisonRows(progress: SeasonPointsProgress, ownId: string, opponentId: string) {
  return progress.rounds.map(({ round, name, snapshot }) => {
    const own = snapshot ? snapshot.points[ownId] ?? 0 : null;
    const opponent = snapshot ? snapshot.points[opponentId] ?? 0 : null;
    return { round, name, own, opponent, gap: own === null || opponent === null ? null : own - opponent };
  });
}

export function getComparisonColor(own: PointsComparisonEntry, opponent: PointsComparisonEntry): string {
  if (own.color.toLowerCase() !== opponent.color.toLowerCase()) return opponent.color;
  return getTeamColor(own.color.toLowerCase() === getTeamColor('red_bull').toLowerCase() ? 'ferrari' : 'red_bull');
}

export function getComparisonChartOption(
  base: { xAxis?: object; yAxis?: object; grid?: object; [key: string]: unknown },
  progress: SeasonPointsProgress,
  own: PointsComparisonEntry,
  opponent: PointsComparisonEntry,
) {
  const rows = buildComparisonRows(progress, own.id, opponent.id);
  const opponentColor = getComparisonColor(own, opponent);
  return {
    ...base,
    grid: { ...base.grid, top: 56 },
    xAxis: { ...base.xAxis, data: rows.map(row => row.name), axisLine: { lineStyle: { color: own.color, opacity: 0.25 } } },
    yAxis: { ...base.yAxis, min: Math.min(0, ...rows.flatMap(row => [row.own ?? 0, row.opponent ?? 0])), interval: undefined,
      splitLine: { lineStyle: { color: own.color, opacity: 0.15, type: 'dashed' } } },
    legend: { data: [own.name, opponent.name], type: 'scroll', top: 0, left: 0, right: 0 },
    tooltip: {
      trigger: 'axis', confine: true, className: 'points-comparison-tooltip',
      backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-primary)',
      textStyle: { color: 'var(--text-primary)' }, extraCssText: 'max-width: min(300px, 80vw); white-space: normal;',
      formatter: (params: { dataIndex: number } | Array<{ dataIndex: number }>) => {
        const row = rows[(Array.isArray(params) ? params[0] : params)?.dataIndex];
        if (!row) return '';
        const points = (value: number | null) => value === null ? '—' : `${formatPointsValue(value)} 分`;
        return `<strong>R${row.round} · ${escapeHtml(row.name)}</strong><br/>`
          + `${escapeHtml(own.name)}：${points(row.own)}<br/>${escapeHtml(opponent.name)}：${points(row.opponent)}<br/>`
          + `<strong>${escapeHtml(own.name)} ${formatPointsGap(row.gap)}</strong>`;
      },
    },
    series: [own, opponent].map((entry, index) => {
      const color = index === 0 ? own.color : opponentColor;
      return {
        name: entry.name, type: 'line', data: rows.map(row => index === 0 ? row.own : row.opponent),
        connectNulls: false, smooth: 0.4, symbol: 'circle', symbolSize: 8,
        lineStyle: { color, width: 4, shadowColor: `${color}40`, shadowBlur: 10, shadowOffsetY: 4 },
        itemStyle: { color, borderWidth: 2, borderColor: '#fff' },
        emphasis: { focus: 'series', scale: 1.5,
          itemStyle: { borderWidth: 3, shadowBlur: 15, shadowColor: color } },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: `${color}60` },
            { offset: 0.5, color: `${color}20` },
            { offset: 1, color: `${color}05` },
          ] } },
      };
    }),
  };
}
