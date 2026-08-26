import { describe, expect, it } from 'vitest';
import {
  hasCompleteSplitTelemetry,
  isCompleteFastF1Payload,
} from '../../scripts/fastf1-payload-completeness.ts';

const common = {
  season: '2026',
  round: '5',
  session: 'R',
  sessionResults: [{}],
  lapTimeSeries: [{}],
  tyreStrategies: [{}],
};

const raceIdentity = { season: '2026', round: '5', session: 'R' };

describe('isCompleteFastF1Payload', () => {
  it('requires race weather and telemetry', () => {
    expect(isCompleteFastF1Payload(common, raceIdentity)).toBe(false);
    expect(isCompleteFastF1Payload({
      ...common,
      weather: { points: [{}] },
    }, raceIdentity, true)).toBe(true);
    expect(isCompleteFastF1Payload({
      ...common,
      weather: { points: [{}] },
      telemetry: { drivers: [{}] },
    }, raceIdentity)).toBe(true);
  });

  it('requires best laps for both qualifying naming formats', () => {
    const sprintQualifying = { ...common, session: 'SQ' };
    expect(isCompleteFastF1Payload(sprintQualifying, {
      ...raceIdentity, session: 'SQ',
    })).toBe(false);
    expect(isCompleteFastF1Payload({ ...common, session: 'SS' }, {
      ...raceIdentity, session: 'SS',
    })).toBe(false);
    expect(isCompleteFastF1Payload({
      ...sprintQualifying,
      qualifyingAnalysis: { bestLaps: [{}] },
    }, { ...raceIdentity, session: 'SQ' })).toBe(true);
  });

  it('rejects empty placeholder payloads', () => {
    expect(isCompleteFastF1Payload({}, raceIdentity)).toBe(false);
    expect(isCompleteFastF1Payload({}, { ...raceIdentity, session: 'S' })).toBe(false);
  });

  it('rejects a complete payload stored under another race identity', () => {
    const completeRace = {
      ...common,
      weather: { points: [{}] },
      telemetry: { drivers: [{}] },
    };
    expect(isCompleteFastF1Payload(completeRace, {
      ...raceIdentity, round: '6',
    })).toBe(false);
  });

  it('rejects split telemetry copied from another race', () => {
    const telemetry = {
      season: '2026',
      round: '5',
      session: 'R',
      telemetry: { drivers: [{}] },
    };
    expect(hasCompleteSplitTelemetry(telemetry, {
      season: '2026', round: '5', session: 'R',
    })).toBe(true);
    expect(hasCompleteSplitTelemetry(telemetry, {
      season: '2026', round: '6', session: 'R',
    })).toBe(false);
  });
});
