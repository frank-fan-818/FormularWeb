import { useCallback } from 'react';
import { useCachedData } from '@/hooks/useCachedData';
import { isRacePredictionFresh } from '@/utils/racePredictionPresentation';

const CACHE_DURATION_MS = 5 * 60 * 1000;
const STALE_DURATION_MS = 24 * 60 * 60 * 1000;

export function useRacePrediction(
  season: string | number | undefined,
  round: string | number | undefined,
) {
  const valid = Number.isInteger(Number(season)) && Number.isInteger(Number(round));
  const fetchPrediction = useCallback(
    async () => {
      const { predictionsApi } = await import('@/api/predictions');
      return predictionsApi.getRacePrediction(Number(season), Number(round));
    },
    [round, season],
  );
  const result = useCachedData(fetchPrediction, {
    cacheKey: `race-prediction:${season || 'none'}:${round || 'none'}`,
    cacheDuration: CACHE_DURATION_MS,
    staleDuration: STALE_DURATION_MS,
    enabled: valid,
  });

  return {
    ...result,
    prediction: result.data,
    predictionIsStale: result.data ? !isRacePredictionFresh(result.data) : false,
  };
}
