import { useState } from 'react';
import type { RaceWinnerPrediction } from '@/types/racePrediction';

interface DetailsState {
  runId: string;
  open: boolean;
  driverId: string | null;
}

/** Scope the disclosure to its published run, so race/account changes cannot retain old details. */
export function usePredictionDetails(prediction: RaceWinnerPrediction | null) {
  const [state, setState] = useState<DetailsState | null>(null);
  if (state && state.runId !== prediction?.runId) setState(null);
  const details = state?.runId === prediction?.runId ? state : null;

  return {
    details,
    openDetails: (driverId = prediction?.candidates[0]?.driverId) => {
      if (prediction && driverId) setState({ runId: prediction.runId, open: true, driverId });
    },
    closeDetails: () => setState((current) => current ? { ...current, open: false } : null),
    selectDriver: (driverId: string | null) => setState((current) => current ? { ...current, driverId } : null),
  };
}
