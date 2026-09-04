import { useRacePrediction } from '@/hooks/useRacePrediction';
import {
  formatPredictionDriverId,
  formatPredictionProbability,
  getRacePredictionPhaseLabel,
} from '@/utils/racePredictionPresentation';

interface RacePredictionSummaryProps {
  season: string | number;
  round: string | number;
  onOpen: () => void;
}

export default function RacePredictionSummary({ season, round, onOpen }: RacePredictionSummaryProps) {
  const { prediction, loading, error, predictionIsStale } = useRacePrediction(season, round);
  const favourite = prediction?.candidates[0];

  if (loading) {
    return <div className="home-prediction-strip is-loading" role="status">正在读取最新冠军预测...</div>;
  }

  if (!prediction || !favourite) {
    return (
      <div className="home-prediction-strip is-empty">
        <div><small>AI WINNER PICK</small><strong>{error ? '\u9884\u6d4b\u670d\u52a1\u6682\u65f6\u4e0d\u53ef\u7528' : '\u7b49\u5f85\u8d5b\u524d\u6570\u636e'}</strong></div>
        <span>数据齐备后自动发布</span>
      </div>
    );
  }

  return (
    <button type="button" className="home-prediction-strip" onClick={onOpen}>
      <div>
        <small>AI WINNER PICK · {getRacePredictionPhaseLabel(prediction.phase)}</small>
        <strong>{formatPredictionDriverId(favourite.driverId)}</strong>
      </div>
      <b>{formatPredictionProbability(favourite.probability)}</b>
      <span className={predictionIsStale ? 'is-stale' : ''}>
        {predictionIsStale ? '\u6570\u636e\u5f85\u66f4\u65b0' : '\u6700\u65b0\u9884\u6d4b'} · 查看 TOP 3 →
      </span>
    </button>
  );
}
