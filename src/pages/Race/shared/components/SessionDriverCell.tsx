import { Link } from 'react-router-dom';
import type { Constructor, Driver } from '@/types';
import { ConstructorLogo } from '@/utils/constructorLogos';
import { DriverAvatar } from '@/utils/driverImages';
import { getTeamColor } from '@/utils/teamColors';
import { LIGHT_TAG_COLORS } from '@/pages/Race/shared/constants';

interface SessionDriverCellProps {
  driver: Driver;
  constructor: Constructor;
}

export function SessionDriverCell({ driver, constructor }: SessionDriverCellProps) {
  const color = getTeamColor(constructor.constructorId);
  const fullName = `${driver.givenName} ${driver.familyName}`.trim();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <DriverAvatar
        driverId={driver.driverId}
        size={32}
        givenName={driver.givenName}
        familyName={driver.familyName}
      />
      <Link
        to={`/drivers/${driver.driverId}`}
        aria-label={`View ${fullName || driver.code} driver profile`}
        style={{
          display: 'inline-block',
          backgroundColor: color,
          color: LIGHT_TAG_COLORS.has(color) ? '#111827' : '#fff',
          fontWeight: 700,
          fontSize: 12,
          padding: '2px 6px',
          borderRadius: 3,
          minWidth: 36,
          textAlign: 'center',
          textDecoration: 'none',
        }}
      >
        {driver.code}
      </Link>
      <ConstructorLogo constructorId={constructor.constructorId} size={24} />
      <span style={{ fontWeight: 500, fontSize: 13 }}>{fullName}</span>
    </div>
  );
}
