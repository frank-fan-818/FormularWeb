import { useState, type CSSProperties } from 'react';
import { ConstructorLogo } from '@/utils/constructorLogos';
import { getNationalityFlag } from '@/utils/driverProfileMedia';
import { getConstructorCar } from '@/utils/constructorProfileMedia';
import { getTeamColor } from '@/utils/teamColors';
import './ConstructorProfileHero.css';

interface ConstructorProfileHeroProps {
  constructorId: string;
  name: string;
  nationality: string;
  season: string;
  rank?: string;
  archive?: boolean;
  firstSeason?: string;
  seasonsCount?: number;
  className?: string;
}

export function ConstructorProfileHero({ constructorId, name, nationality, season, rank, archive = false,
  firstSeason, seasonsCount, className = '' }: ConstructorProfileHeroProps) {
  const car = getConstructorCar(constructorId, season);
  const flag = getNationalityFlag(nationality);
  const [failedCar, setFailedCar] = useState<string | null>(null);
  const [failedFlag, setFailedFlag] = useState<string | null>(null);
  const showCar = car && failedCar !== car;

  return (
    <section className={`constructor-profile-hero team-profile-hero ${className}`}
      aria-label={`${name} 车队档案`}
      style={{ '--team-profile-accent': getTeamColor(constructorId) } as CSSProperties}>
      <div className="team-profile-copy">
        <div className="team-profile-kicker">
          <ConstructorLogo key={constructorId} constructorId={constructorId} size={24} onDark />
          <span>FORMULA ONE TEAM</span>
        </div>
        <h1 className="constructor-profile-name team-profile-name" title={name}>{name || '-'}</h1>
        <dl className="team-profile-meta constructor-profile-summary">
          <div><dt>注册国籍</dt><dd className="team-profile-nationality">
            {flag && failedFlag !== flag ? <img src={flag} alt="" width={28} height={20}
              className="team-profile-flag" onError={() => setFailedFlag(flag)} /> : null}
            {nationality || '-'}
          </dd></div>
          {season ? <div><dt>{archive ? '最近赛季' : '赛季'}</dt><dd>{season}</dd></div> : null}
          {archive && firstSeason ? <div><dt>参赛跨度</dt><dd>{firstSeason}–{season}</dd></div> : null}
          {archive && seasonsCount ? <div><dt>历史赛季</dt><dd>{seasonsCount} 季</dd></div> : null}
          {!archive ? <div><dt>赛季排名</dt><dd>{rank ? `P${rank}` : '-'}</dd></div> : null}
        </dl>
      </div>
      <div className="team-profile-watermark" aria-hidden="true">{!archive && rank ? `P${rank}` : season}</div>
      <div className={`team-profile-art${showCar ? '' : ' is-fallback'}`}>
        {showCar && car ? <>
          <img className="team-profile-car" src={car} width={3392} height={746} alt={`${season} ${name} 赛车侧视图`}
            fetchPriority="high" decoding="async" onError={() => setFailedCar(car)} />
          <span className="team-profile-car-caption">{season} / RACECAR PROFILE</span>
        </> : <ConstructorLogo key={constructorId} constructorId={constructorId} size={144} onDark className="team-profile-logo-fallback" />}
      </div>
    </section>
  );
}
