import { describe, expect, it } from 'vitest';
import {
  formatPredictionDriverId,
  formatPredictionProbability,
  getRacePredictionPhaseLabel,
  isRacePredictionFresh,
} from './racePredictionPresentation';

describe('race prediction presentation', () => {
  it('labels prediction phases without exposing internal enum names', () => {
    expect(getRacePredictionPhaseLabel('pre_weekend')).toBe('\u8d5b\u524d\u9884\u6d4b');
    expect(getRacePredictionPhaseLabel('post_quali')).toBe('\u6392\u4f4d\u8d5b\u540e');
  });

  it('marks predictions older than six hours as stale', () => {
    const now = Date.parse('2026-09-03T12:00:00.000Z');
    expect(isRacePredictionFresh({ generatedAt: '2026-09-03T06:30:00.000Z' }, now)).toBe(true);
    expect(isRacePredictionFresh({ generatedAt: '2026-09-03T05:59:59.000Z' }, now)).toBe(false);
    expect(isRacePredictionFresh({ generatedAt: 'invalid' }, now)).toBe(false);
  });

  it('formats bounded probabilities and stable driver ids', () => {
    expect(formatPredictionProbability(0.423)).toBe('42%');
    expect(formatPredictionProbability(4)).toBe('100%');
    expect(formatPredictionDriverId('max_verstappen')).toBe('Max Verstappen');
  });
});
