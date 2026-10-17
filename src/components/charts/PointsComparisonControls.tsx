import { useId } from 'react';
import { Button } from 'antd';
import type { usePointsComparison } from '@/hooks/usePointsComparison';
import './PointsComparisonControls.css';

type Comparison = ReturnType<typeof usePointsComparison>;

export function PointsComparisonButton({ comparison }: { comparison: Comparison }) {
  return <Button onClick={comparison.toggle} aria-expanded={comparison.enabled}
    aria-label={comparison.enabled ? '结束对比' : '对比'}
    disabled={!comparison.own || !comparison.entries.length}>
    {comparison.enabled ? '结束对比' : '对比'}
  </Button>;
}

export function PointsComparisonControls({ comparison, kind }: { comparison: Comparison; kind: 'driver' | 'constructor' }) {
  const selectId = useId();
  if (!comparison.enabled) return null;
  const { opponent, data, loading, error, progress } = comparison;
  const partial = data?.rounds.some(round => !round.snapshot);
  const label = kind === 'driver' ? '选择对比车手' : '选择对比车队';

  return <div className="points-comparison-controls">
    <div className="points-comparison-picker">
      <label htmlFor={selectId}>{label}</label>
      <select id={selectId} aria-label={label} value={opponent?.id ?? ''} onChange={event => comparison.select(event.target.value || null)}>
        <option value="">{label}</option>
        {comparison.entries.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
      </select>
      {data && opponent && <span className="points-comparison-round">截至第 {data.latest.round} 站</span>}
    </div>
    {!opponent && <p className="points-comparison-hint">选择后查看双方积分走势与逐站差距。</p>}
    {loading && <div className="points-comparison-loading" role="status" aria-live="polite">
      <span className="points-comparison-spinner" aria-hidden="true" />
      <strong>正在读取逐站积分…</strong>
      {progress && <span>已完成 {progress.completed} / {progress.total} 站</span>}
      {progress && <progress aria-label="逐站积分读取进度" value={progress.completed} max={progress.total} />}
    </div>}
    {error && <div className="points-comparison-message" role="alert">暂时无法读取对比数据。<Button aria-label="重试" onClick={comparison.retry}>重试</Button></div>}
    {partial && <div className="points-comparison-message">部分分站积分暂缺，曲线保留空缺。<Button type="link" onClick={comparison.retry}>重新加载</Button></div>}
  </div>;
}
