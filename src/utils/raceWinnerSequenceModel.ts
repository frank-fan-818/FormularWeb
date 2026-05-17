export interface RaceWinnerSequenceStep {
  finishAdvantage: number;
  qualifyingAdvantage: number;
  podium: number;
  win: number;
  reliability: number;
}

export interface RaceWinnerSequenceEmbedding {
  momentum: number;
  consistency: number;
  upside: number;
}

const INPUT_WEIGHTS = [
  [0.42, 0.22, 0.28],
  [0.22, 0.34, 0.28],
  [0.18, 0.3, 0.4],
  [0.28, 0.16, 0.46],
  [0.18, 0.42, 0.08],
];

const RECURRENT_WEIGHTS = [
  [0.34, -0.08, 0.06],
  [0.1, 0.28, 0.04],
  [0.08, 0.06, 0.32],
];

const BIAS = [-0.42, -0.34, -0.5];

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function squash(value: number) {
  return (Math.tanh(value) + 1) / 2;
}

export function buildRaceWinnerSequenceEmbedding(
  sequence: RaceWinnerSequenceStep[],
): RaceWinnerSequenceEmbedding {
  if (!sequence.length) {
    return {
      momentum: 0.5,
      consistency: 0.5,
      upside: 0.5,
    };
  }

  let state = [0, 0, 0];
  const normalized = sequence.slice(-10).map((step) => [
    clamp01(step.finishAdvantage),
    clamp01(step.qualifyingAdvantage),
    clamp01(step.podium),
    clamp01(step.win),
    clamp01(step.reliability),
  ]);

  normalized.forEach((input) => {
    state = state.map((_, stateIndex) => {
      const inputSignal = input.reduce((sum, value, inputIndex) =>
        sum + value * INPUT_WEIGHTS[inputIndex][stateIndex], BIAS[stateIndex]);
      const recurrentSignal = state.reduce((sum, value, recurrentIndex) =>
        sum + value * RECURRENT_WEIGHTS[recurrentIndex][stateIndex], 0);
      return Math.tanh(inputSignal + recurrentSignal);
    });
  });

  return {
    momentum: squash(state[0]),
    consistency: squash(state[1]),
    upside: squash(state[2]),
  };
}
