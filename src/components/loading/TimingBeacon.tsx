import './TimingBeacon.css';

export type TimingBeaconVariant = 'page' | 'panel' | 'inline';

interface TimingBeaconProps {
  variant?: TimingBeaconVariant;
  label?: string;
  detail?: string;
  className?: string;
}

const STAGES = ['REQUEST', 'VALIDATE', 'RENDER'];

export function TimingBeacon({
  variant = 'panel',
  label = 'Synchronising race data',
  detail = 'Timing · strategy · conditions',
  className = '',
}: TimingBeaconProps) {
  const classes = ['timing-beacon', `timing-beacon--${variant}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classes}
      role="status"
      aria-live="polite"
      aria-label={`${label}. ${detail}`}
      data-loading-variant={variant}
    >
      <div className="timing-beacon__topline" aria-hidden="true">
        <span>LIVE DATA LINK</span>
        <span className="timing-beacon__sync"><i />SYNCING</span>
      </div>

      <div className="timing-beacon__track" aria-hidden="true">
        <span className="timing-beacon__rail" />
        <span className="timing-beacon__scan" />
        <span className="timing-beacon__marker" />
        {[0, 1, 2, 3].map((node) => (
          <i key={node} className="timing-beacon__node" />
        ))}
      </div>

      <div className="timing-beacon__copy">
        <strong>{label}</strong>
        <span>{detail}</span>
      </div>

      {variant !== 'inline' ? (
        <div className="timing-beacon__stages" aria-hidden="true">
          {STAGES.map((stage, index) => (
            <span key={stage}><i>{String(index + 1).padStart(2, '0')}</i>{stage}</span>
          ))}
        </div>
      ) : null}

      <div className="timing-beacon__segments" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((segment) => <i key={segment} />)}
      </div>
    </div>
  );
}

export function ChartLoadingBeacon({ label = 'Rendering telemetry' }: { label?: string }) {
  return (
    <TimingBeacon
      variant="inline"
      label={label}
      detail="Preparing the interactive data view"
    />
  );
}

export default TimingBeacon;
