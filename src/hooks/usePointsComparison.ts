import { useEffect, useState } from 'react';
import type { PointsComparisonEntry, PointsComparisonKind, PointsLoadingProgress, SeasonPointsProgress } from '@/types/pointsComparison';

export function usePointsComparison(kind: PointsComparisonKind, season: string, ownId: string, entries: PointsComparisonEntry[]) {
  const context = `${kind}:${season}:${ownId}`;
  const [selection, setSelection] = useState<{ context: string; opponentId: string | null } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string; data: SeasonPointsProgress | null; error: boolean; loading: boolean; progress?: PointsLoadingProgress } | null>(null);
  if (selection && selection.context !== context) setSelection(null);
  const enabled = selection?.context === context;
  const own = entries.find(entry => entry.id === ownId);
  const opponent = enabled ? entries.find(entry => entry.id === selection?.opponentId && entry.id !== ownId) : undefined;
  const hasOpponent = Boolean(opponent);
  const key = `${kind}:${season}`;

  useEffect(() => {
    if (!enabled || !hasOpponent) return;
    let active = true;
    setState({ key, data: null, error: false, loading: true });
    void import('@/api/standingsProgress').then(({ standingsProgressApi }) => standingsProgressApi.getSeasonProgress(kind, season, progress => {
      if (active) setState({ key, data: null, error: false, loading: true, progress });
    }))
      .then(data => { if (active) setState({ key, data, error: false, loading: false }); })
      .catch(() => { if (active) setState({ key, data: null, error: true, loading: false }); });
    return () => { active = false; };
  // Changing opponents reuses the already loaded full standings, without another request.
  }, [kind, season, key, enabled, hasOpponent, attempt]);

  const current = enabled && opponent && state?.key === key ? state : null;
  return {
    enabled, own, opponent, entries: entries.filter(entry => entry.id !== ownId),
    data: current?.data ?? null, error: current?.error ?? false,
    loading: Boolean(opponent) && (!current || current.loading),
    progress: current?.progress,
    toggle: () => setSelection(enabled ? null : { context, opponentId: null }),
    select: (opponentId: string | null) => setSelection({ context, opponentId }),
    retry: () => setAttempt(value => value + 1),
  };
}
