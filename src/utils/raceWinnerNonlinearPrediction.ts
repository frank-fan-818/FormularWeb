import {
  WINNER_PREDICTION_FEATURES,
  type WinnerPredictionCandidate,
  type WinnerPredictionFeatureName,
  type WinnerPredictionMetrics,
  type WinnerPredictionResult,
} from './raceWinnerPrediction.ts';

export interface NonlinearWinnerPredictionModel {
  featureNames: readonly WinnerPredictionFeatureName[];
  hiddenSize: number;
  inputWeights: number[][];
  hiddenBiases: number[];
  outputWeights: number[];
  outputBias: number;
}

export interface TrainNonlinearWinnerModelOptions {
  featureNames?: readonly WinnerPredictionFeatureName[];
  hiddenSize?: number;
  iterations?: number;
  learningRate?: number;
  l2?: number;
}

export interface ResidualWinnerTrainingSample {
  candidate: WinnerPredictionCandidate;
  target: number;
}

const DEFAULT_OPTIONS = {
  hiddenSize: 8,
  iterations: 24,
  learningRate: 0.035,
  l2: 0.001,
};

function seededWeight(input: number, hidden: number) {
  const value = Math.sin((input + 1) * 12.9898 + (hidden + 1) * 78.233) * 43758.5453;
  return (value - Math.floor(value) - 0.5) * 0.08;
}

function candidateVector(
  candidate: WinnerPredictionCandidate,
  featureNames: readonly WinnerPredictionFeatureName[],
) {
  return featureNames.map((featureName) => {
    const value = candidate.features[featureName] || 0;
    return Number.isFinite(value) ? value : 0;
  });
}

function forwardVector(vector: number[], model: NonlinearWinnerPredictionModel) {
  const hiddenRaw = model.hiddenBiases.map((bias, hiddenIndex) =>
    bias + vector.reduce((sum, value, inputIndex) =>
      sum + value * (model.inputWeights[inputIndex]?.[hiddenIndex] || 0), 0),
  );
  const hidden = hiddenRaw.map(Math.tanh);
  const score = model.outputBias + hidden.reduce((sum, value, hiddenIndex) =>
    sum + value * (model.outputWeights[hiddenIndex] || 0), 0);

  return { hiddenRaw, hidden, score };
}

export function scoreNonlinearWinnerCandidate(
  candidate: WinnerPredictionCandidate,
  model: NonlinearWinnerPredictionModel,
) {
  return forwardVector(candidateVector(candidate, model.featureNames), model).score;
}

export function trainResidualWinnerPredictionModel(
  samples: ResidualWinnerTrainingSample[],
  options: TrainNonlinearWinnerModelOptions = {},
): NonlinearWinnerPredictionModel {
  const featureNames = options.featureNames || WINNER_PREDICTION_FEATURES;
  const hiddenSize = options.hiddenSize ?? DEFAULT_OPTIONS.hiddenSize;
  const iterations = options.iterations ?? DEFAULT_OPTIONS.iterations;
  const learningRate = options.learningRate ?? DEFAULT_OPTIONS.learningRate;
  const l2 = options.l2 ?? DEFAULT_OPTIONS.l2;
  const model: NonlinearWinnerPredictionModel = {
    featureNames,
    hiddenSize,
    inputWeights: featureNames.map((_, inputIndex) =>
      Array.from({ length: hiddenSize }, (__, hiddenIndex) => seededWeight(inputIndex, hiddenIndex)),
    ),
    hiddenBiases: Array.from({ length: hiddenSize }, () => 0),
    outputWeights: Array.from({ length: hiddenSize }, (_, hiddenIndex) => seededWeight(hiddenIndex, 199)),
    outputBias: 0,
  };
  const validSamples = samples.filter((sample) =>
    Number.isFinite(sample.target) && sample.candidate,
  );

  if (!validSamples.length) {
    return model;
  }

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const inputGradient = featureNames.map(() => Array.from({ length: hiddenSize }, () => 0));
    const hiddenBiasGradient = Array.from({ length: hiddenSize }, () => 0);
    const outputGradient = Array.from({ length: hiddenSize }, () => 0);
    let outputBiasGradient = 0;

    validSamples.forEach((sample) => {
      const vector = candidateVector(sample.candidate, featureNames);
      const forward = forwardVector(vector, model);
      const error = forward.score - sample.target;
      outputBiasGradient += error;

      forward.hidden.forEach((hiddenValue, hiddenIndex) => {
        outputGradient[hiddenIndex] += error * hiddenValue;
        const hiddenError = error * model.outputWeights[hiddenIndex] * (1 - hiddenValue ** 2);
        hiddenBiasGradient[hiddenIndex] += hiddenError;

        vector.forEach((inputValue, inputIndex) => {
          inputGradient[inputIndex][hiddenIndex] += hiddenError * inputValue;
        });
      });
    });

    const scale = 1 / validSamples.length;
    model.outputBias -= learningRate * outputBiasGradient * scale;
    model.outputWeights = model.outputWeights.map((weight, hiddenIndex) =>
      weight - learningRate * (outputGradient[hiddenIndex] * scale + l2 * weight),
    );
    model.hiddenBiases = model.hiddenBiases.map((bias, hiddenIndex) =>
      bias - learningRate * hiddenBiasGradient[hiddenIndex] * scale,
    );
    model.inputWeights = model.inputWeights.map((weights, inputIndex) =>
      weights.map((weight, hiddenIndex) =>
        weight - learningRate * (inputGradient[inputIndex][hiddenIndex] * scale + l2 * weight),
      ),
    );
  }

  return model;
}

export function predictNonlinearWinnerRace(
  candidates: WinnerPredictionCandidate[],
  model: NonlinearWinnerPredictionModel,
): WinnerPredictionResult[] {
  if (!candidates.length) {
    return [];
  }

  const scores = candidates.map((candidate) => scoreNonlinearWinnerCandidate(candidate, model));
  const maxScore = Math.max(...scores);
  const exponentials = scores.map((score) => Math.exp(score - maxScore));
  const total = exponentials.reduce((sum, value) => sum + value, 0) || 1;

  return candidates
    .map((candidate, index) => ({
      driverId: candidate.driverId,
      constructorId: candidate.constructorId,
      score: scores[index],
      probability: exponentials[index] / total,
      winner: candidate.winner,
      rank: 0,
      factors: [],
    }))
    .sort((left, right) => right.probability - left.probability)
    .map((result, index) => ({
      ...result,
      rank: index + 1,
    }));
}

export function trainNonlinearWinnerPredictionModel(
  raceGroups: WinnerPredictionCandidate[][],
  options: TrainNonlinearWinnerModelOptions = {},
): NonlinearWinnerPredictionModel {
  const featureNames = options.featureNames || WINNER_PREDICTION_FEATURES;
  const hiddenSize = options.hiddenSize ?? DEFAULT_OPTIONS.hiddenSize;
  const iterations = options.iterations ?? DEFAULT_OPTIONS.iterations;
  const learningRate = options.learningRate ?? DEFAULT_OPTIONS.learningRate;
  const l2 = options.l2 ?? DEFAULT_OPTIONS.l2;
  const validRaceGroups = raceGroups.filter((race) =>
    race.length > 1 && race.some((candidate) => candidate.winner),
  );
  const model: NonlinearWinnerPredictionModel = {
    featureNames,
    hiddenSize,
    inputWeights: featureNames.map((_, inputIndex) =>
      Array.from({ length: hiddenSize }, (__, hiddenIndex) => seededWeight(inputIndex, hiddenIndex)),
    ),
    hiddenBiases: Array.from({ length: hiddenSize }, () => 0),
    outputWeights: Array.from({ length: hiddenSize }, (_, hiddenIndex) => seededWeight(hiddenIndex, 99)),
    outputBias: 0,
  };

  if (!validRaceGroups.length) {
    return model;
  }

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const inputGradient = featureNames.map(() => Array.from({ length: hiddenSize }, () => 0));
    const hiddenBiasGradient = Array.from({ length: hiddenSize }, () => 0);
    const outputGradient = Array.from({ length: hiddenSize }, () => 0);
    let outputBiasGradient = 0;

    validRaceGroups.forEach((race) => {
      const vectors = race.map((candidate) => candidateVector(candidate, featureNames));
      const forwards = vectors.map((vector) => forwardVector(vector, model));
      const maxScore = Math.max(...forwards.map((item) => item.score));
      const exponentials = forwards.map((item) => Math.exp(item.score - maxScore));
      const total = exponentials.reduce((sum, value) => sum + value, 0) || 1;
      const probabilities = exponentials.map((value) => value / total);

      race.forEach((candidate, candidateIndex) => {
        const error = probabilities[candidateIndex] - (candidate.winner ? 1 : 0);
        outputBiasGradient += error;

        forwards[candidateIndex].hidden.forEach((hiddenValue, hiddenIndex) => {
          outputGradient[hiddenIndex] += error * hiddenValue;
          const hiddenError = error * model.outputWeights[hiddenIndex] * (1 - hiddenValue ** 2);
          hiddenBiasGradient[hiddenIndex] += hiddenError;

          vectors[candidateIndex].forEach((inputValue, inputIndex) => {
            inputGradient[inputIndex][hiddenIndex] += hiddenError * inputValue;
          });
        });
      });
    });

    const scale = 1 / validRaceGroups.length;
    model.outputBias -= learningRate * outputBiasGradient * scale;

    model.outputWeights = model.outputWeights.map((weight, hiddenIndex) =>
      weight - learningRate * (outputGradient[hiddenIndex] * scale + l2 * weight),
    );
    model.hiddenBiases = model.hiddenBiases.map((bias, hiddenIndex) =>
      bias - learningRate * hiddenBiasGradient[hiddenIndex] * scale,
    );
    model.inputWeights = model.inputWeights.map((weights, inputIndex) =>
      weights.map((weight, hiddenIndex) =>
        weight - learningRate * (inputGradient[inputIndex][hiddenIndex] * scale + l2 * weight),
      ),
    );
  }

  return model;
}

export function evaluateNonlinearWinnerPredictions(
  raceGroups: WinnerPredictionCandidate[][],
  model: NonlinearWinnerPredictionModel,
): WinnerPredictionMetrics {
  const validRaceGroups = raceGroups.filter((race) =>
    race.length > 1 && race.some((candidate) => candidate.winner),
  );

  if (!validRaceGroups.length) {
    return {
      raceCount: 0,
      top1Accuracy: 0,
      top3Accuracy: 0,
      averageWinnerRank: 0,
      logLoss: 0,
      brierScore: 0,
    };
  }

  let top1Hits = 0;
  let top3Hits = 0;
  let rankTotal = 0;
  let logLossTotal = 0;
  let brierTotal = 0;

  validRaceGroups.forEach((race) => {
    const prediction = predictNonlinearWinnerRace(race, model);
    const winner = prediction.find((result) => result.winner);
    const winnerProbability = Math.max(winner?.probability || 0, 1e-12);

    top1Hits += winner?.rank === 1 ? 1 : 0;
    top3Hits += winner && winner.rank <= 3 ? 1 : 0;
    rankTotal += winner?.rank || prediction.length;
    logLossTotal += -Math.log(winnerProbability);
    brierTotal += prediction.reduce((sum, result) => {
      const expected = result.winner ? 1 : 0;
      return sum + (result.probability - expected) ** 2;
    }, 0);
  });

  return {
    raceCount: validRaceGroups.length,
    top1Accuracy: top1Hits / validRaceGroups.length,
    top3Accuracy: top3Hits / validRaceGroups.length,
    averageWinnerRank: rankTotal / validRaceGroups.length,
    logLoss: logLossTotal / validRaceGroups.length,
    brierScore: brierTotal / validRaceGroups.length,
  };
}
