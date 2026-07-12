export function assertCompleteList<T>(
  items: T[],
  expectedTotal: string | number | undefined,
  label: string,
): T[] {
  const total = Number(expectedTotal);
  if (Number.isFinite(total) && total > 0 && items.length !== total) {
    throw new Error(`${label} is partial: expected ${total}, received ${items.length}`);
  }
  return items;
}
export function assertUniqueValues<T>(items: T[], valueOf: (item: T) => string, label: string): T[] {
  const values = items.map(valueOf);
  if (new Set(values).size !== values.length) {
    throw new Error(`${label} contains duplicate identifiers`);
  }
  return items;
}

export function assertContiguousRounds<T>(items: T[], roundOf: (item: T) => number, label: string): T[] {
  const rounds = items.map(roundOf).sort((left, right) => left - right);
  if (rounds.some((round, index) => round !== index + 1)) {
    throw new Error(`${label} contains missing or invalid rounds`);
  }
  return items;
}
