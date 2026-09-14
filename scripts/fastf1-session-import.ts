export async function importIndependently<T extends { season: number; round: number; session: string }>(
  rows: T[],
  upsert: (row: T) => Promise<void>,
): Promise<{ imported: number; failed: Array<{ key: string; code: string }> }> {
  let imported = 0;
  const failed: Array<{ key: string; code: string }> = [];
  for (const row of rows) {
    try {
      await upsert(row);
      imported += 1;
    } catch (error) {
      const candidate = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      failed.push({ key: `${row.season}/${row.round}/${row.session}`, code: /^[A-Z0-9_]{1,32}$/i.test(candidate) ? candidate : 'database_error' });
    }
  }
  return { imported, failed };
}
