type NetworkInformation = { saveData?: boolean; effectiveType?: string };

function canPrefetch(): boolean {
  if (typeof navigator === 'undefined') return false;
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  return !connection?.saveData
    && connection?.effectiveType !== '2g'
    && connection?.effectiveType !== 'slow-2g';
}
export function preloadRaceInfoRoute(): void {
  if (!canPrefetch()) return;
  void Promise.all([
    import('@/pages/Race/RaceLayout'),
    import('@/pages/Race/RaceInfo'),
  ]).catch(() => {
    // Navigation remains the source of truth when speculative loading fails.
  });
}
