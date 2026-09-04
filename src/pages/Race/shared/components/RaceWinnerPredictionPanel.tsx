import { Button, Card, Tag } from 'antd';
import { useRacePrediction } from '@/hooks/useRacePrediction';
import { getTeamColor } from '@/utils/teamColors';
import {
  formatPredictionDriverId,
  formatPredictionProbability,
  getPredictionFactorLabel,
  getRacePredictionPhaseLabel,
} from '@/utils/racePredictionPresentation';

interface RaceWinnerPredictionPanelProps {
  season: string | number;
  round: string | number;
}

export function RaceWinnerPredictionPanel({ season, round }: RaceWinnerPredictionPanelProps) {
  const { prediction, loading, error, refetch, predictionIsStale } = useRacePrediction(season, round);
  const topThree = prediction?.candidates.slice(0, 3) || [];

  return (
    <section className="race-info-section race-prediction-section" aria-labelledby="race-prediction-heading">
      <div className="race-info-section-heading">
        <span id="race-prediction-heading">冠军预测</span>
        <small>结合发车位、近期表现与赛道特征，随赛周数据自动更新</small>
      </div>
      <Card className="race-weekend-card race-prediction-card" loading={loading}>
        {error && !prediction ? (
          <div className="race-prediction-state" role="alert">
            <strong>预测服务暂时不可用</strong>
            <span>历史数据和其他赛事模块不受影响。</span>
            <Button onClick={refetch}>重试预测</Button>
          </div>
        ) : !prediction || !topThree.length ? (
          <div className="race-prediction-state">
            <strong>等待可用的赛前数据</strong>
            <span>首版预测会在参赛阵容确定后发布，排位赛后生成最终版。</span>
          </div>
        ) : (
          <>
            <div className="race-prediction-meta">
              <Tag color={prediction.phase === 'post_quali' ? 'blue' : 'default'}>{getRacePredictionPhaseLabel(prediction.phase)}</Tag>
              <span className={predictionIsStale ? 'is-stale' : ''}>
                {predictionIsStale ? '\u6570\u636e\u5f85\u66f4\u65b0' : '\u6570\u636e\u5df2\u66f4\u65b0'}
              </span>
              <time dateTime={prediction.generatedAt}>
                {new Date(prediction.generatedAt).toLocaleString('zh-CN', { hour12: false })}
              </time>
              <small>{prediction.modelVersion}</small>
            </div>
            <ol className="race-prediction-ranking">
              {topThree.map((candidate) => (
                <li key={candidate.driverId} className={candidate.rank === 1 ? 'is-favourite' : ''}>
                  <span className="race-prediction-rank">P{candidate.rank}</span>
                  <i style={{ background: getTeamColor(candidate.constructorId) }} />
                  <div>
                    <strong>{formatPredictionDriverId(candidate.driverId)}</strong>
                    <small>{candidate.constructorId.replace(/[_-]+/g, ' ')}</small>
                  </div>
                  <b>{formatPredictionProbability(candidate.probability)}</b>
                  <div className="race-prediction-factors">
                    {candidate.factors.filter((factor) => factor.contribution > 0).slice(0, 2).map((factor) => (
                      <Tag key={factor.feature}>{getPredictionFactorLabel(factor.feature)}</Tag>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
            <p className="race-prediction-disclaimer">概率反映模型对当前数据的判断，不代表比赛结果保证。</p>
          </>
        )}
      </Card>
    </section>
  );
}
