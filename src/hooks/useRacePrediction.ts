import { useEffect, useState, useCallback } from 'react';
import type { RaceWinnerPrediction } from '@/types/racePrediction';
import { useAuthSession } from './useAuthSession';
import { isRacePredictionFresh } from '@/utils/racePredictionPresentation';

// Member predictions stay in component memory, never IndexedDB/localStorage.
export function useRacePrediction(season: string | number | undefined, round: string | number | undefined) {
  const { session } = useAuthSession();
  const userId = session?.user.id;
  const [state, setState] = useState<{ key: string; data: RaceWinnerPrediction | null; loading: boolean; error: Error | null }>({ key: '', data: null, loading: false, error: null });
  const [attempt, setAttempt] = useState(0);
  const key = `${userId || ''}:${season}:${round}`;
  const valid = Boolean(userId) && Number.isInteger(Number(season)) && Number.isInteger(Number(round));
  useEffect(() => {
    if (!valid) { setState({ key, data: null, loading: false, error: null }); return; }
    let active = true;
    setState({ key, data: null, loading: true, error: null });
    void import('@/api/predictions').then(({ predictionsApi }) => {
      if (!active) return null;
      return predictionsApi.getRacePrediction(Number(season), Number(round));
    }).then((data) => {
      if (active) setState({ key, data, loading: false, error: null });
    }).catch((error: unknown) => {
      if (active) setState({ key, data: null, loading: false, error: error instanceof Error ? error : new Error('预测数据暂时不可用') });
    });
    return () => { active = false; };
  }, [key, valid, season, round, attempt]);
  const prediction = valid && state.key === key ? state.data : null;
  return { prediction, loading: valid && (state.key !== key || state.loading), error: valid && state.key === key ? state.error : null,
    predictionIsStale: prediction ? !isRacePredictionFresh(prediction) : false,
    refetch: useCallback(() => setAttempt((value) => value + 1), []),
  };
}
