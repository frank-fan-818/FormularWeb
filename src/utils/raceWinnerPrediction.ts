export const WINNER_PREDICTION_FEATURES = [
  'gridAdvantage',
  'gridPole',
  'gridFrontRow',
  'gridTop3',
  'poleModelProbability',
  'poleModelRankAdvantage',
  'poleModelScore',
  'qualifyingAdvantage',
  'qualifyingPole',
  'qualifyingFrontRow',
  'qualifyingPaceAdvantage',
  'qualifyingPaceSharpAdvantage',
  'teamMateQualifyingAdvantage',
  'fp1Advantage',
  'fp2Advantage',
  'fp3Advantage',
  'fpBestAdvantage',
  'fpAverageAdvantage',
  'fpBestGapAdvantage',
  'fpLapsShare',
  'fpTeamMateAdvantage',
  'fpConstructorAdvantage',
  'driverLongRunPaceForm',
  'constructorLongRunPaceForm',
  'driverTyreManagementForm',
  'constructorTyreManagementForm',
  'driverStintLengthForm',
  'constructorStintLengthForm',
  'driverPitStopForm',
  'constructorPitStopForm',
  'driverFastestLapForm',
  'constructorFastestLapForm',
  'driverTelemetrySpeedForm',
  'constructorTelemetrySpeedForm',
  'driverGridGainForm',
  'constructorGridGainForm',
  'driverChaosForm',
  'constructorChaosForm',
  'driverRestartProxyForm',
  'constructorRestartProxyForm',
  'driverSafetyCarForm',
  'constructorSafetyCarForm',
  'driverVirtualSafetyCarForm',
  'constructorVirtualSafetyCarForm',
  'driverRedFlagForm',
  'constructorRedFlagForm',
  'driverQualifyingConversionForm',
  'constructorQualifyingConversionForm',
  'driverTyrePaceBlend',
  'constructorTyrePaceBlend',
  'driverPostPitPaceForm',
  'constructorPostPitPaceForm',
  'driverStrategyGainForm',
  'constructorStrategyGainForm',
  'driverRestartPaceForm',
  'constructorRestartPaceForm',
  'driverRestartGainForm',
  'constructorRestartGainForm',
  'driverSafetyCarGainForm',
  'constructorSafetyCarGainForm',
  'driverHotTrackTyreForm',
  'constructorHotTrackTyreForm',
  'driverWetTrackPaceForm',
  'constructorWetTrackPaceForm',
  'constructorUpgradeProxy',
  'constructorDeclaredUpgradeIntensity',
  'constructorDeclaredUpgradeCount',
  'constructorPerformanceUpgradeIntent',
  'constructorCircuitSpecificUpgradeIntent',
  'constructorReliabilityUpgradeIntent',
  'declaredUpgradeTrackFit',
  'declaredUpgradeConstructorMomentum',
  'declaredUpgradeDriverAdaptation',
  'declaredUpgradePracticeValidation',
  'declaredUpgradeLongRunValidation',
  'declaredUpgradeTrackTypeInteraction',
  'driverUpgradeAdaptationProxy',
  'driverShortRecentWinRate',
  'driverSequenceMomentum',
  'driverSequenceConsistency',
  'driverSequenceUpside',
  'driverFinishTrend',
  'driverQualifyingTrend',
  'driverWinTrend',
  'driverPodiumTrend',
  'driverRecentFinishForm',
  'driverRecentPodiumRate',
  'driverRecentWinRate',
  'driverLongRecentWinRate',
  'constructorShortRecentWinRate',
  'constructorSequenceMomentum',
  'constructorSequenceConsistency',
  'constructorSequenceUpside',
  'constructorFinishTrend',
  'constructorQualifyingTrend',
  'constructorWinTrend',
  'constructorPodiumTrend',
  'constructorRecentFinishForm',
  'constructorRecentPodiumRate',
  'constructorRecentWinRate',
  'constructorLongRecentWinRate',
  'driverStandingAdvantage',
  'driverStandingPointsShare',
  'constructorStandingAdvantage',
  'constructorStandingPointsShare',
  'driverSeasonWinRate',
  'constructorSeasonWinRate',
  'sameCircuitDriverWinRate',
  'sameCircuitDriverPodiumRate',
  'sameCircuitConstructorWinRate',
  'sameCircuitPoleWinRate',
  'sameCircuitTop3GridWinRate',
  'sameCircuitChaosRate',
  'sameCircuitSafetyCarRate',
  'sameCircuitVirtualSafetyCarRate',
  'sameCircuitRedFlagRate',
  'sameCircuitOvertakeUpsetRate',
  'circuitStreetTrack',
  'circuitLowOvertake',
  'circuitTyreStress',
  'circuitRestartRisk',
  'circuitQualifyingImportance',
  'weatherRainRisk',
  'weatherCoolTrack',
  'weatherHotTrack',
  'weatherHumidity',
  'weatherWind',
  'weatherTrackAirDelta',
  'driverSimilarWeatherForm',
  'constructorSimilarWeatherForm',
  'driverRainWeatherForm',
  'constructorRainWeatherForm',
  'driverHotTrackForm',
  'constructorHotTrackForm',
  'driverCoolTrackForm',
  'constructorCoolTrackForm',
  'driverWindWeatherReliability',
  'constructorWindWeatherReliability',
  'rainDriverInteraction',
  'rainConstructorInteraction',
  'hotTrackConstructorInteraction',
  'coolTrackDriverInteraction',
  'windReliabilityInteraction',
  'sprintWeekend',
  'sprintFinishAdvantage',
  'sprintQualifyingAdvantage',
  'driverRecentReliability',
  'constructorRecentReliability',
  'raceRoundProgress',
  'gridPoleCircuitInteraction',
  'gridFrontRowCircuitInteraction',
  'gridTop3CircuitInteraction',
  'driverCircuitFamiliarityInteraction',
  'constructorCircuitFamiliarityInteraction',
  'chaosRacecraftInteraction',
  'restartRacecraftInteraction',
  'safetyCarRacecraftInteraction',
  'redFlagRacecraftInteraction',
  'tyreStressPaceInteraction',
  'postPitStrategyInteraction',
  'restartPaceInteraction',
  'weatherTyreInteraction',
  'upgradeTrendInteraction',
  'upgradePracticeInteraction',
  'upgradeRacePaceInteraction',
  'upgradeTrackFitInteraction',
  'trackTypeFamiliarityInteraction',
  'qualifyingConversionInteraction',
  'constructorQualifyingInteraction',
  'driverTeamMateInteraction',
  'driverTrendSeasonInteraction',
  'constructorTrendStrengthInteraction',
] as const;

export type WinnerPredictionFeatureName = typeof WINNER_PREDICTION_FEATURES[number];

export type WinnerPredictionEra =
  | 'classic'
  | 'turbo_na'
  | 'modern_refuel_end'
  | 'pirelli_hybrid'
  | 'ground_effect';

export interface WinnerPredictionFeatureVector {
  [featureName: string]: number;
}

export interface WinnerPredictionCandidate {
  raceKey: string;
  driverId: string;
  constructorId: string;
  winner: boolean;
  features: WinnerPredictionFeatureVector;
}

export interface WinnerPredictionWeights {
  bias: number;
  weights: Partial<Record<WinnerPredictionFeatureName, number>>;
}

export interface WinnerPredictionFactor {
  feature: WinnerPredictionFeatureName;
  value: number;
  weight: number;
  contribution: number;
}

export interface WinnerPredictionResult {
  driverId: string;
  constructorId: string;
  score: number;
  probability: number;
  winner: boolean;
  rank: number;
  factors: WinnerPredictionFactor[];
}

export interface WinnerPredictionMetrics {
  raceCount: number;
  top1Accuracy: number;
  top3Accuracy: number;
  averageWinnerRank: number;
  logLoss: number;
  brierScore: number;
}

export interface TrainWinnerModelOptions {
  featureNames?: readonly WinnerPredictionFeatureName[];
  iterations?: number;
  learningRate?: number;
  l2?: number;
}

const DEFAULT_TRAINING_OPTIONS = {
  iterations: 240,
  learningRate: 0.08,
  l2: 0.002,
};

export function getWinnerPredictionEra(season: number): WinnerPredictionEra {
  if (season <= 1979) {
    return 'classic';
  }

  if (season <= 1999) {
    return 'turbo_na';
  }

  if (season <= 2009) {
    return 'modern_refuel_end';
  }

  if (season <= 2021) {
    return 'pirelli_hybrid';
  }

  return 'ground_effect';
}

export function groupCandidatesByRace(
  candidates: WinnerPredictionCandidate[],
): WinnerPredictionCandidate[][] {
  const groups = new Map<string, WinnerPredictionCandidate[]>();

  candidates.forEach((candidate) => {
    const raceCandidates = groups.get(candidate.raceKey) || [];
    raceCandidates.push(candidate);
    groups.set(candidate.raceKey, raceCandidates);
  });

  return [...groups.values()];
}

export function scoreWinnerCandidate(
  candidate: WinnerPredictionCandidate,
  model: WinnerPredictionWeights,
  featureNames: readonly WinnerPredictionFeatureName[] = WINNER_PREDICTION_FEATURES,
) {
  return featureNames.reduce((score, featureName) => {
    return score + (candidate.features[featureName] || 0) * (model.weights[featureName] || 0);
  }, model.bias);
}

export function predictWinnerRace(
  candidates: WinnerPredictionCandidate[],
  model: WinnerPredictionWeights,
  featureNames: readonly WinnerPredictionFeatureName[] = WINNER_PREDICTION_FEATURES,
): WinnerPredictionResult[] {
  if (!candidates.length) {
    return [];
  }

  const scores = candidates.map((candidate) => scoreWinnerCandidate(candidate, model, featureNames));
  const maxScore = Math.max(...scores);
  const exponentials = scores.map((score) => Math.exp(score - maxScore));
  const total = exponentials.reduce((sum, value) => sum + value, 0) || 1;

  return candidates
    .map((candidate, index) => {
      const factors = featureNames
        .map((feature) => ({
          feature,
          value: candidate.features[feature] || 0,
          weight: model.weights[feature] || 0,
          contribution: (candidate.features[feature] || 0) * (model.weights[feature] || 0),
        }))
        .filter((factor) => Math.abs(factor.contribution) > 0.0001)
        .sort((left, right) => Math.abs(right.contribution) - Math.abs(left.contribution))
        .slice(0, 5);

      return {
        driverId: candidate.driverId,
        constructorId: candidate.constructorId,
        score: scores[index],
        probability: exponentials[index] / total,
        winner: candidate.winner,
        rank: 0,
        factors,
      };
    })
    .sort((left, right) => right.probability - left.probability)
    .map((result, index) => ({
      ...result,
      rank: index + 1,
    }));
}

export function trainWinnerPredictionModel(
  raceGroups: WinnerPredictionCandidate[][],
  options: TrainWinnerModelOptions = {},
): WinnerPredictionWeights {
  const featureNames = options.featureNames || WINNER_PREDICTION_FEATURES;
  const iterations = options.iterations ?? DEFAULT_TRAINING_OPTIONS.iterations;
  const learningRate = options.learningRate ?? DEFAULT_TRAINING_OPTIONS.learningRate;
  const l2 = options.l2 ?? DEFAULT_TRAINING_OPTIONS.l2;
  const weights: Partial<Record<WinnerPredictionFeatureName, number>> = {};
  let bias = 0;

  featureNames.forEach((featureName) => {
    weights[featureName] = 0;
  });

  const validRaceGroups = raceGroups.filter((race) =>
    race.length > 1 && race.some((candidate) => candidate.winner),
  );

  if (!validRaceGroups.length) {
    return { bias, weights };
  }

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const gradient: Partial<Record<WinnerPredictionFeatureName, number>> = {};
    let biasGradient = 0;

    featureNames.forEach((featureName) => {
      gradient[featureName] = 0;
    });

    validRaceGroups.forEach((race) => {
      const prediction = predictWinnerRace(race, { bias, weights }, featureNames);
      const probabilityByDriver = new Map(prediction.map((result) => [result.driverId, result.probability]));

      race.forEach((candidate) => {
        const error = (probabilityByDriver.get(candidate.driverId) || 0) - (candidate.winner ? 1 : 0);
        biasGradient += error;
        featureNames.forEach((featureName) => {
          gradient[featureName] = (gradient[featureName] || 0) + error * (candidate.features[featureName] || 0);
        });
      });
    });

    const scale = 1 / validRaceGroups.length;
    bias -= learningRate * biasGradient * scale;

    featureNames.forEach((featureName) => {
      const currentWeight = weights[featureName] || 0;
      const regularizedGradient = (gradient[featureName] || 0) * scale + l2 * currentWeight;
      weights[featureName] = currentWeight - learningRate * regularizedGradient;
    });
  }

  return { bias, weights };
}

export function evaluateWinnerPredictions(
  raceGroups: WinnerPredictionCandidate[][],
  model: WinnerPredictionWeights,
  featureNames: readonly WinnerPredictionFeatureName[] = WINNER_PREDICTION_FEATURES,
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
    const prediction = predictWinnerRace(race, model, featureNames);
    const winner = prediction.find((result) => result.winner);
    const winnerProbability = Math.max(winner?.probability || 0, 1e-12);

    if (winner?.rank === 1) {
      top1Hits += 1;
    }

    if (winner && winner.rank <= 3) {
      top3Hits += 1;
    }

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

export function buildPoleBaselineModel(): WinnerPredictionWeights {
  return {
    bias: 0,
    weights: {
      gridAdvantage: 4,
      gridPole: 4,
      gridFrontRow: 1.5,
      gridTop3: 1,
    },
  };
}
