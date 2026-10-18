import type { PredictionPreRaceObservation } from '@/types/predictionData';

export function appendPreRaceObservation(previous: PredictionPreRaceObservation[], next: PredictionPreRaceObservation): PredictionPreRaceObservation[] {
  const signature = (row: PredictionPreRaceObservation) => JSON.stringify([...row.entries].sort((a, b) => a.driverId.localeCompare(b.driverId)));
  const last = previous[previous.length - 1];
  const withoutGrid = (row: PredictionPreRaceObservation) => ({ ...row, entries: row.entries.map(({ driverId, constructorId }) => ({ driverId, constructorId })) });
  if (last && next.entries.every((row) => row.gridPosition === undefined) && last.entries.every((row) => row.gridPosition !== undefined) &&
    signature(withoutGrid(last)) === signature(withoutGrid(next))) return previous;
  return last && signature(last) === signature(next) ? previous : [...previous, next];
}
