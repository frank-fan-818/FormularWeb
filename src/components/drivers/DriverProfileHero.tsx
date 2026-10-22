import { useState, type CSSProperties } from 'react';
import type { Driver } from '@/types';
import { ConstructorLogo } from '@/utils/constructorLogos';
import { DriverAvatar } from '@/utils/driverImages';
import { getDriverPortrait, getNationalityFlag } from '@/utils/driverProfileMedia';

interface DriverProfileHeroProps {
  driver: Pick<Driver, 'driverId' | 'givenName' | 'familyName' | 'code' | 'permanentNumber' | 'nationality'>;
  season: string;
  teamId: string;
  teamName: string;
  teamColor: string;
  archive?: boolean;
}

export function DriverProfileHero({ driver, season, teamId, teamName, teamColor, archive = false }: DriverProfileHeroProps) {
  const portrait = getDriverPortrait(driver.driverId, season, driver.givenName, driver.familyName);
  const flag = getNationalityFlag(driver.nationality);
  const [failedPortrait, setFailedPortrait] = useState<string | null>(null);
  const [failedFlag, setFailedFlag] = useState<string | null>(null);
  const showPortrait = Boolean(portrait && failedPortrait !== portrait);
  const name = `${driver.givenName} ${driver.familyName}`.trim();

  return (
    <section className={`driver-profile-hero${showPortrait ? ' has-portrait' : ''}`}
      aria-label={`${name} 车手档案`}
      style={{ '--driver-accent': teamColor } as CSSProperties}>
      <div className="driver-profile-copy">
        <div className="driver-profile-kicker">
          <ConstructorLogo constructorId={teamId} size={20} onDark className="driver-profile-team-logo" />
          <span>{teamName || '-'}</span>
        </div>
        <h1 className="driver-profile-name">
          <span>{driver.givenName || '-'}</span>
          <strong>{driver.familyName}</strong>
        </h1>
        <dl className="driver-profile-meta">
          <div><dt>国籍</dt><dd className="driver-profile-nationality">
            {flag && failedFlag !== flag ? <img className="driver-profile-flag" src={flag} alt=""
              width={28} height={20} onError={() => setFailedFlag(flag)} /> : null}
            {driver.nationality || '-'}
          </dd></div>
          {driver.permanentNumber ? <div><dt>车号</dt><dd>#{driver.permanentNumber}</dd></div> : null}
          {driver.code ? <div><dt>简称</dt><dd>{driver.code}</dd></div> : null}
          {season ? <div><dt>{archive ? '最近赛季' : '赛季'}</dt><dd>{season}</dd></div> : null}
        </dl>
      </div>
      <div className="driver-profile-number" aria-hidden="true">{driver.permanentNumber}</div>
      <div className={`driver-profile-portrait${showPortrait ? '' : ' is-fallback'}`}>
        {showPortrait && portrait ? <img src={portrait} alt={`${name} 站姿照`} width={720} height={2069}
          fetchPriority="high" decoding="async" onError={() => setFailedPortrait(portrait)} /> : (
          <DriverAvatar driverId={driver.driverId} givenName={driver.givenName} familyName={driver.familyName}
            size={180} className="driver-profile-avatar" />
        )}
      </div>
    </section>
  );
}
