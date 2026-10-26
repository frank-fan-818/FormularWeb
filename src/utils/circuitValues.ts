// External metadata sometimes uses placeholder strings instead of null.
export function hasCircuitValue(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  const text = String(value ?? '').trim().toLowerCase();
  return Boolean(text) && !['-', '--', '—', 'n/a', 'unknown', 'null', 'undefined', '未知', '资料待补'].includes(text);
}

export function firstCircuitValue<T>(...values: T[]): T | undefined {
  return values.find(hasCircuitValue);
}
