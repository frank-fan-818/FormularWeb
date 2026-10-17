import { useId } from 'react';
import { Modal } from 'antd';
import type { RaceWinnerPrediction } from '@/types/racePrediction';
import { formatPredictionDriverId, getRacePredictionPhaseLabel, isRacePredictionFresh } from '@/utils/racePredictionPresentation';
import { formatDetailedProbability, getPredictionFactors, sortPredictionCandidates } from '@/utils/racePredictionDetails';
import { getTeamColor } from '@/utils/teamColors';
import './RacePredictionDetails.css';

interface RacePredictionDetailsProps {
  prediction: RaceWinnerPrediction;
  open: boolean;
  driverId: string | null;
  onClose: () => void;
  onSelect: (driverId: string | null) => void;
}

export default function RacePredictionDetails({ prediction, open, driverId, onClose, onSelect }: RacePredictionDetailsProps) {
  const id = useId();
  const candidates = sortPredictionCandidates(prediction.candidates);
  const stale = !isRacePredictionFresh(prediction);

  return (
    <Modal
      open={open}
      title="夺冠概率与预测依据"
      footer={null}
      onCancel={onClose}
      width={720}
      className="prediction-details-modal"
      centered
      destroyOnHidden
    >
      <div className="prediction-details-intro">
        <h2>{prediction.raceName}</h2>
        <p>{getRacePredictionPhaseLabel(prediction.phase)} · 已发布 {candidates.length} 位车手{stale && <span className="prediction-details-stale"> · 数据待更新</span>}</p>
      </div>
      <p className="prediction-details-instruction">点击车手，查看主要预测依据</p>
      <ol className="prediction-details-roster" aria-label="全部已发布车手夺冠概率">
        {candidates.map((candidate) => {
          const expanded = driverId === candidate.driverId;
          const factors = getPredictionFactors(candidate.factors);
          const reasonId = `${id}-${candidate.driverId}`;
          return (
            <li key={candidate.driverId} className={expanded ? 'is-expanded' : ''}>
              <button type="button" className="prediction-details-driver" aria-expanded={expanded}
                aria-controls={reasonId} onClick={() => onSelect(expanded ? null : candidate.driverId)}>
                <span className="prediction-details-rank">{candidate.rank}</span>
                <span className="prediction-details-identity">
                  <strong>{formatPredictionDriverId(candidate.driverId)}</strong>
                  <span>{candidate.constructorId.replace(/[_-]+/g, ' ')}</span>
                  <span className="prediction-details-track" aria-hidden="true">
                    <span style={{ width: `${candidate.probability * 100}%`, background: getTeamColor(candidate.constructorId) }} />
                  </span>
                </span>
                <b>{formatDetailedProbability(candidate.probability)}</b>
                <span className="prediction-details-chevron" aria-hidden="true">{expanded ? '−' : '+'}</span>
              </button>
              <div id={reasonId} hidden={!expanded} className="prediction-details-reasons">
                <h3>主要预测依据</h3>
                {factors.length ? (
                  <>
                    <ul>{factors.map((factor, index) => (
                      <li key={`${factor.label}-${index}`}>
                        <span>{factor.label}</span>
                        <strong className={`is-${factor.direction}`}>{factor.direction === 'positive' ? '有利因素' : '不利因素'}</strong>
                      </li>
                    ))}</ul>
                    <p>按对模型评分的影响程度排列。有利因素提高评分，不利因素降低评分；综合所有车手的评分后得到夺冠概率。</p>
                  </>
                ) : <p>本次发布未提供该车手的具体评分因素，暂时无法展示预测依据。</p>}
              </div>
            </li>
          );
        })}
      </ol>
      <details className="prediction-details-source">
        <summary>数据说明</summary>
        <p>展示本次发布的全部候选人。概率反映模型对当前数据的判断，不代表比赛结果保证；评分因素的影响不等同于概率百分点。</p>
        <dl>
          <div><dt>预测生成</dt><dd><time dateTime={prediction.generatedAt}>{new Date(prediction.generatedAt).toLocaleString('zh-CN', { hour12: false })}</time></dd></div>
          <div><dt>数据截止</dt><dd><time dateTime={prediction.dataCutoffAt}>{new Date(prediction.dataCutoffAt).toLocaleString('zh-CN', { hour12: false })}</time></dd></div>
          <div><dt>模型版本</dt><dd>{prediction.modelVersion}</dd></div>
        </dl>
      </details>
    </Modal>
  );
}
