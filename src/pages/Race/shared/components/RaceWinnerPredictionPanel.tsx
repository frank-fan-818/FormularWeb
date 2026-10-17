import { lazy, Suspense } from 'react';
import { Button, Card } from 'antd';
import { useRacePrediction } from '@/hooks/useRacePrediction';
import { usePredictionDetails } from '@/hooks/usePredictionDetails';
import { getTeamColor } from '@/utils/teamColors';
import {
  formatPredictionDriverId,
  formatPredictionProbability,
  getRacePredictionPhaseLabel,
} from '@/utils/racePredictionPresentation';

const RacePredictionDetails = lazy(() => import('@/components/RacePredictionDetails'));

interface RaceWinnerPredictionPanelProps {
  season: string | number;
  round: string | number;
}

export function RaceWinnerPredictionPanel({ season, round }: RaceWinnerPredictionPanelProps) {
  const { prediction, loading, error, refetch, predictionIsStale } = useRacePrediction(season, round);
  const { details, openDetails, closeDetails, selectDriver } = usePredictionDetails(prediction);
  const topThree = prediction?.candidates.slice(0, 3) || [];

  return (
    <section className="race-info-section race-prediction-section" aria-labelledby="race-prediction-heading">
      <div className="race-info-section-heading">
        <span id="race-prediction-heading">冠军预测</span>
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
              <span>{getRacePredictionPhaseLabel(prediction.phase)}</span>
              {predictionIsStale && <span className="is-stale">数据待更新</span>}
              <Button type="link" aria-haspopup="dialog" onClick={() => openDetails()}>查看全部概率与依据 →</Button>
            </div>
            <ol className="race-prediction-ranking">
              {topThree.map((candidate) => (
                <li key={candidate.driverId} className={candidate.rank === 1 ? 'is-favourite' : ''}>
                  <button type="button" className="race-prediction-candidate" aria-haspopup="dialog" onClick={() => openDetails(candidate.driverId)}>
                    <span className="race-prediction-rank">P{candidate.rank}</span>
                    <i style={{ background: getTeamColor(candidate.constructorId) }} aria-hidden="true" />
                    <span className="race-prediction-identity">
                      <strong>{formatPredictionDriverId(candidate.driverId)}</strong>
                      <small>{candidate.constructorId.replace(/[_-]+/g, ' ')}</small>
                    </span>
                    <b>{formatPredictionProbability(candidate.probability)}</b>
                  </button>
                </li>
              ))}
            </ol>
          </>
        )}
      </Card>
      {prediction && details && (
        <Suspense fallback={<p role="status">正在打开预测详情…</p>}>
          <RacePredictionDetails prediction={prediction} open={details.open} driverId={details.driverId}
            onClose={closeDetails} onSelect={selectDriver} />
        </Suspense>
      )}
    </section>
  );
}
