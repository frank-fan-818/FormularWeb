import { lazy, Suspense } from 'react';
import { MemberAccess } from '@/components/auth/AccessGate';
import { useRacePrediction } from '@/hooks/useRacePrediction';
import { usePredictionDetails } from '@/hooks/usePredictionDetails';
import {
  formatPredictionDriverId,
  formatPredictionProbability,
  getRacePredictionPhaseLabel,
} from '@/utils/racePredictionPresentation';

const RacePredictionDetails = lazy(() => import('./RacePredictionDetails'));

interface RacePredictionSummaryProps {
  season: string | number;
  round: string | number;
}

function PredictionContent({ season, round }: RacePredictionSummaryProps) {
  const { prediction, loading, error, predictionIsStale } = useRacePrediction(season, round);
  const { details, openDetails, closeDetails, selectDriver } = usePredictionDetails(prediction);
  const favourite = prediction?.candidates[0];

  if (loading) {
    return <div className="home-prediction-strip is-loading" role="status">正在读取最新冠军预测...</div>;
  }

  if (!prediction || !favourite) {
    return (
      <div className="home-prediction-strip is-empty">
        <div><small>冠军预测</small><strong>{error ? '\u9884\u6d4b\u670d\u52a1\u6682\u65f6\u4e0d\u53ef\u7528' : '\u7b49\u5f85\u8d5b\u524d\u6570\u636e'}</strong></div>
        <span>数据齐备后自动发布</span>
      </div>
    );
  }

  return (
    <>
    <button type="button" className="home-prediction-strip" aria-haspopup="dialog" onClick={() => openDetails()}>
      <div>
        <small>冠军预测 · {getRacePredictionPhaseLabel(prediction.phase)}</small>
        <strong>{formatPredictionDriverId(favourite.driverId)}</strong>
      </div>
      <b>{formatPredictionProbability(favourite.probability)}</b>
      <span className={predictionIsStale ? 'is-stale' : ''}>
        {predictionIsStale ? '数据待更新 · ' : ''}查看全部概率与依据 →
      </span>
    </button>
    {details && (
      <Suspense fallback={<p role="status">正在打开预测详情…</p>}>
        <RacePredictionDetails prediction={prediction} open={details.open} driverId={details.driverId}
          onClose={closeDetails} onSelect={selectDriver} />
      </Suspense>
    )}
    </>
  );
}

export default function RacePredictionSummary(props: RacePredictionSummaryProps) {
  return <MemberAccess feature="赛事预测" compact><PredictionContent {...props} /></MemberAccess>;
}
