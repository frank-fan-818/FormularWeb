import type { RacePredictionCandidate } from '@/types/racePrediction';

const SHARED_LABELS: Record<string, string> = {
  LongRunPaceForm: '长距离速度', TyreManagementForm: '轮胎管理', StintLengthForm: '单段续航表现',
  PitStopForm: '进站表现', FastestLapForm: '最快圈表现', TelemetrySpeedForm: '遥测速度表现',
  GridGainForm: '正赛位置提升', ChaosForm: '混乱赛况表现', RestartProxyForm: '重启表现参考',
  SafetyCarForm: '安全车赛况表现', VirtualSafetyCarForm: '虚拟安全车赛况表现', RedFlagForm: '红旗赛况表现',
  QualifyingConversionForm: '排位转化为正赛成绩的能力', TyrePaceBlend: '轮胎与速度综合表现',
  PostPitPaceForm: '进站后速度', StrategyGainForm: '策略收益', RestartPaceForm: '重启后速度',
  RestartGainForm: '重启后位置提升', SafetyCarGainForm: '安全车阶段位置提升',
  HotTrackTyreForm: '高温赛道轮胎表现', WetTrackPaceForm: '湿地速度',
  ShortRecentWinRate: '短期胜率', SequenceMomentum: '近期成绩势头', SequenceConsistency: '近期成绩稳定性',
  SequenceUpside: '近期成绩上升空间', FinishTrend: '完赛成绩趋势', QualifyingTrend: '排位成绩趋势',
  WinTrend: '获胜趋势', PodiumTrend: '领奖台趋势', RecentFinishForm: '近期完赛表现',
  RecentPodiumRate: '近期领奖台率', RecentWinRate: '近期胜率', LongRecentWinRate: '较长周期胜率',
  StandingAdvantage: '积分榜排名', StandingPointsShare: '积分占比', SeasonWinRate: '本赛季胜率',
  SimilarWeatherForm: '相似天气表现', RainWeatherForm: '雨天表现', HotTrackForm: '高温赛道表现',
  CoolTrackForm: '低温赛道表现', WindWeatherReliability: '有风天气的完赛可靠性', RecentReliability: '近期完赛可靠性',
};

const FEATURE_LABELS: Record<string, string> = {
  gridAdvantage: '发车位置', gridPole: '杆位发车', gridFrontRow: '头排发车', gridTop3: '前三位发车',
  poleModelProbability: '杆位预测概率', poleModelRankAdvantage: '杆位预测排名', poleModelScore: '杆位预测评分',
  qualifyingAdvantage: '排位赛表现', qualifyingPole: '排位赛杆位', qualifyingFrontRow: '排位赛头排',
  qualifyingPaceAdvantage: '排位赛单圈速度', qualifyingPaceSharpAdvantage: '排位赛速度突出程度',
  teamMateQualifyingAdvantage: '与队友的排位比较',
  fp1Advantage: '一练表现', fp2Advantage: '二练表现', fp3Advantage: '三练表现', fpBestAdvantage: '练习赛最佳表现',
  fpAverageAdvantage: '练习赛平均表现', fpBestGapAdvantage: '练习赛最快圈差距', fpLapsShare: '练习赛圈数占比',
  fpTeamMateAdvantage: '练习赛队友比较', fpConstructorAdvantage: '车队练习赛表现',
  constructorUpgradeProxy: '车队升级效果参考', constructorDeclaredUpgradeIntensity: '车队申报升级强度',
  constructorDeclaredUpgradeCount: '车队申报升级数量', constructorPerformanceUpgradeIntent: '车队性能升级方向',
  constructorCircuitSpecificUpgradeIntent: '车队赛道专项升级', constructorReliabilityUpgradeIntent: '车队可靠性升级',
  declaredUpgradeTrackFit: '申报升级与赛道的适配', declaredUpgradeConstructorMomentum: '申报升级与车队势头',
  declaredUpgradeDriverAdaptation: '车手对申报升级的适应', declaredUpgradePracticeValidation: '练习赛对升级的验证',
  declaredUpgradeLongRunValidation: '长距离对升级的验证', declaredUpgradeTrackTypeInteraction: '升级与赛道类型的关联',
  driverUpgradeAdaptationProxy: '车手升级适应参考',
  sameCircuitDriverWinRate: '车手本站历史胜率', sameCircuitDriverPodiumRate: '车手本站历史领奖台率',
  sameCircuitConstructorWinRate: '车队本站历史胜率', sameCircuitPoleWinRate: '本站杆位历史胜率',
  sameCircuitTop3GridWinRate: '本站前三位发车历史胜率', sameCircuitChaosRate: '本站历史混乱赛况频率',
  sameCircuitSafetyCarRate: '本站历史安全车频率', sameCircuitVirtualSafetyCarRate: '本站历史虚拟安全车频率',
  sameCircuitRedFlagRate: '本站历史红旗频率', sameCircuitOvertakeUpsetRate: '本站历史逆袭频率',
  circuitStreetTrack: '街道赛道特征', circuitLowOvertake: '赛道超车难度', circuitTyreStress: '赛道轮胎负荷',
  circuitRestartRisk: '赛道重启风险', circuitQualifyingImportance: '本站排位重要性',
  weatherRainRisk: '降雨风险', weatherCoolTrack: '低温赛道条件', weatherHotTrack: '高温赛道条件',
  weatherHumidity: '空气湿度', weatherWind: '风力条件', weatherTrackAirDelta: '赛道与气温差',
  rainDriverInteraction: '降雨与车手表现的关联', rainConstructorInteraction: '降雨与车队表现的关联',
  hotTrackConstructorInteraction: '高温与车队表现的关联', coolTrackDriverInteraction: '低温与车手表现的关联',
  windReliabilityInteraction: '风力与可靠性的关联', sprintWeekend: '冲刺赛周末', sprintFinishAdvantage: '冲刺赛表现',
  sprintQualifyingAdvantage: '冲刺排位表现', raceRoundProgress: '赛季进度',
  gridPoleCircuitInteraction: '杆位与赛道特征的关联', gridFrontRowCircuitInteraction: '头排发车与赛道的关联',
  gridTop3CircuitInteraction: '前三位发车与赛道的关联', driverCircuitFamiliarityInteraction: '车手赛道熟悉度',
  constructorCircuitFamiliarityInteraction: '车队赛道熟悉度', chaosRacecraftInteraction: '混乱赛况下的比赛能力',
  restartRacecraftInteraction: '重启阶段的比赛能力', safetyCarRacecraftInteraction: '安全车阶段的比赛能力',
  redFlagRacecraftInteraction: '红旗赛况下的比赛能力', tyreStressPaceInteraction: '轮胎负荷与速度的关联',
  postPitStrategyInteraction: '进站后速度与策略的关联', restartPaceInteraction: '重启条件与速度的关联',
  weatherTyreInteraction: '天气与轮胎表现的关联', upgradeTrendInteraction: '升级与成绩趋势的关联',
  upgradePracticeInteraction: '升级与练习赛表现的关联', upgradeRacePaceInteraction: '升级与正赛速度的关联',
  upgradeTrackFitInteraction: '升级与赛道适配的关联', trackTypeFamiliarityInteraction: '赛道类型熟悉度',
  qualifyingConversionInteraction: '排位与正赛成绩的关联', constructorQualifyingInteraction: '车队实力与排位的关联',
  driverTeamMateInteraction: '车手与队友表现的比较', driverTrendSeasonInteraction: '车手趋势与赛季表现的关联',
  constructorTrendStrengthInteraction: '车队趋势与实力的关联',
};

export function getPredictionFactorLabel(feature: string): string {
  if (FEATURE_LABELS[feature]) return FEATURE_LABELS[feature];
  const match = /^(driver|constructor)(.+)$/.exec(feature);
  if (match && SHARED_LABELS[match[2]]) {
    return `${match[1] === 'driver' ? '车手' : '车队'}${SHARED_LABELS[match[2]]}`;
  }
  return '其他模型指标';
}

export function getPredictionFactors(factors: RacePredictionCandidate['factors']) {
  return factors
    .filter(({ contribution }) => Number.isFinite(contribution) && contribution !== 0)
    .slice()
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .map(({ feature, contribution }) => ({
      label: getPredictionFactorLabel(feature),
      direction: contribution > 0 ? 'positive' as const : 'negative' as const,
    }));
}

export function formatDetailedProbability(probability: number): string {
  if (probability > 0 && probability < 0.001) return '<0.1%';
  if (probability < 1 && probability > 0.999) return '>99.9%';
  return `${Math.round((Math.max(0, Math.min(1, probability)) + Number.EPSILON) * 1000) / 10}%`;
}

export function sortPredictionCandidates(candidates: RacePredictionCandidate[]) {
  return [...candidates].sort((a, b) => b.probability - a.probability || a.rank - b.rank);
}
