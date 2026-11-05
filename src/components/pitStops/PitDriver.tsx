import { DriverAvatar } from '@/utils/driverImages';

export function PitDriver({ name, team, driverId, code }: {
  name: string;
  team: string;
  driverId?: string;
  code?: string;
}) {
  return <div className="pit-driver">
    <span className="pit-driver-avatar" aria-hidden="true">
      <DriverAvatar driverId={driverId || name} size={32} />
    </span>
    <div>
      <span className="pit-driver-name">{name || code || '—'}</span>
      <span className="pit-secondary">{[code, team].filter(Boolean).join(' · ')}</span>
    </div>
  </div>;
}
