const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** Theme text on transparent charts; deliberately styled ranking canvases keep their palette. */
export function applyChartTextTheme(option: unknown, text: string, muted: string): unknown {
  const root = record(option);
  if (root.backgroundColor && root.backgroundColor !== 'transparent') return option;
  const map = (value: unknown, transform: (item: Record<string, unknown>) => Record<string, unknown>) =>
    Array.isArray(value) ? value.map(item => transform(record(item))) : value ? transform(record(value)) : value;
  const axis = (item: Record<string, unknown>) => ({ ...item,
    axisLabel: { hideOverlap: true, ...record(item.axisLabel), color: muted },
    nameTextStyle: { ...record(item.nameTextStyle), color: muted },
  });
  return { ...root,
    xAxis: map(root.xAxis, axis), yAxis: map(root.yAxis, axis),
    legend: map(root.legend, item => ({ ...item, textStyle: { ...record(item.textStyle), color: text } })),
  };
}
