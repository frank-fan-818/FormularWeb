import './TimingBeacon.css';

export type TimingBeaconVariant = 'page' | 'panel' | 'inline';

interface TimingBeaconProps {
  variant?: TimingBeaconVariant;
  label?: string;
  detail?: string;
  className?: string;
}

export function TimingBeacon({
  variant = 'panel',
  label = '正在加载数据',
  detail = '',
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
      aria-label={[label, detail].filter(Boolean).join('. ')}
      aria-busy="true"
      data-loading-variant={variant}
    >
      <span className="loading-indicator" aria-hidden="true" />
      <div className="timing-beacon__copy">
        <strong>{label}</strong>
        {detail ? <span>{detail}</span> : null}
      </div>
    </div>
  );
}

export function ChartLoadingBeacon({ label = '正在加载图表' }: { label?: string }) {
  return (
    <TimingBeacon
      variant="inline"
      label={label}
    />
  );
}

export default TimingBeacon;
