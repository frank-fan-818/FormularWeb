import { describe, expect, it } from 'vitest';
import { buildRaceWinnerSequenceEmbedding } from './raceWinnerSequenceModel';

describe('race winner sequence model', () => {
  it('returns neutral embedding for missing sequence history', () => {
    expect(buildRaceWinnerSequenceEmbedding([])).toEqual({
      momentum: 0.5,
      consistency: 0.5,
      upside: 0.5,
    });
  });

  it('gives stronger embedding to improving podium sequences', () => {
    const weak = buildRaceWinnerSequenceEmbedding([
      { finishAdvantage: 0.2, qualifyingAdvantage: 0.2, podium: 0, win: 0, reliability: 1 },
      { finishAdvantage: 0.25, qualifyingAdvantage: 0.25, podium: 0, win: 0, reliability: 1 },
      { finishAdvantage: 0.3, qualifyingAdvantage: 0.3, podium: 0, win: 0, reliability: 1 },
    ]);
    const strong = buildRaceWinnerSequenceEmbedding([
      { finishAdvantage: 0.75, qualifyingAdvantage: 0.7, podium: 1, win: 0, reliability: 1 },
      { finishAdvantage: 0.85, qualifyingAdvantage: 0.8, podium: 1, win: 0, reliability: 1 },
      { finishAdvantage: 1, qualifyingAdvantage: 0.95, podium: 1, win: 1, reliability: 1 },
    ]);

    expect(strong.momentum).toBeGreaterThan(weak.momentum);
    expect(strong.upside).toBeGreaterThan(weak.upside);
  });
});
