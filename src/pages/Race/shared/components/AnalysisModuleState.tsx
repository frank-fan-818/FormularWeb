import { Button, Card } from 'antd';
import { TimingBeacon } from '@/components/loading/TimingBeacon';

interface AnalysisModuleStateProps {
  id?: string;
  index: string;
  label: string;
  title: string;
  description: string;
  state: 'loading' | 'empty' | 'error';
  actionLabel?: string;
  onAction?: () => void;
}

export function AnalysisModuleState({
  id,
  index,
  label,
  title,
  description,
  state,
  actionLabel,
  onAction,
}: AnalysisModuleStateProps) {
  return (
    <Card
      id={id}
      data-module-index={index}
      data-module-state={state}
      className="fastf1-chart-card analysis-module-state-card"
      title={(
        <div className="fastf1-chart-header">
          <div>
            <span className="analysis-module-kicker">{index} / {label}</span>
            <h3 className="fastf1-chart-title">{title}</h3>
          </div>
        </div>
      )}
    >
      {state === 'loading' ? (
        <TimingBeacon
          variant="inline"
          label={`Synchronising ${label.toLowerCase()}`}
          detail="FastF1 data · validation · chart model"
        />
      ) : (
        <div className="analysis-module-message" role={state === 'error' ? 'alert' : 'status'}>
          <span className="analysis-module-status">{state === 'error' ? 'SOURCE ERROR' : 'AWAITING DATA'}</span>
          <p>{description}</p>
          {actionLabel && onAction ? <Button onClick={onAction}>{actionLabel}</Button> : null}
        </div>
      )}
    </Card>
  );
}
