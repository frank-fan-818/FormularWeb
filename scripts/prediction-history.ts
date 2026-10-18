import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { PredictionPreRaceObservation, PredictionSeasonRaceData, PredictionSeasonSnapshot } from '../src/types/predictionData.ts';

export function loadPreRaceObservations(season: number, round: number): PredictionPreRaceObservation[] {
  const file = path.resolve('data/prediction/pre-race', String(season), `${round}.json`);
  if (!existsSync(file)) return [];
  const snapshot = JSON.parse(readFileSync(file, 'utf8')) as { schemaVersion: number; season: number; round: number; observations: PredictionPreRaceObservation[] };
  if (snapshot.schemaVersion !== 1 || snapshot.season !== season || snapshot.round !== round || !Array.isArray(snapshot.observations)) throw new Error('Invalid pre-race observation snapshot');
  return snapshot.observations;
}

/** Use a single provider's identifiers and raw fields in training and publication. */
export function loadPredictionHistory(fromSeason = 2022, toSeason = new Date().getUTCFullYear()): PredictionSeasonRaceData[] {
  const races: PredictionSeasonRaceData[] = [];
  for (let season = fromSeason; season <= toSeason; season += 1) {
    const file = path.resolve('data/prediction/seasons', `${season}.json`);
    if (!existsSync(file)) throw new Error(`Missing prediction history ${season}; run prediction:sync -- --season-from ${fromSeason} --season ${toSeason}`);
    const snapshot = JSON.parse(readFileSync(file, 'utf8')) as PredictionSeasonSnapshot;
    if (snapshot.schemaVersion !== 1 || snapshot.season !== season || !Array.isArray(snapshot.races)) throw new Error(`Invalid prediction snapshot ${season}`);
    races.push(...snapshot.races.map((race) => ({ ...race, preRaceObservations: loadPreRaceObservations(season, race.round) })));
  }
  return races;
}
