import { useNavigate } from 'react-router-dom';
import type { CSSProperties } from 'react';
import DocumentHead from '@/components/DocumentHead';
import { useSeasonDataCached } from '@/hooks/useSeasonDataCached';
import { useRacesByStatus } from '@/hooks/useRaceStatus';
import { useAppStore } from '@/store';
import { formatRaceDateTimeFull } from '@/utils/raceSchedule';
import { daysUntilLocalDate, formatLocalDateTime } from '@/utils/dateTime';
import { getTeamColor } from '@/utils/teamColors';
import ProductMasthead from '@/components/product/ProductMasthead';

const preloadRoute = (pathname: string) => {
  void import('@/utils/routePreload').then((module) => module.preloadRoute(pathname));
};

const preloadRaceInfoRoute = () => preloadRoute('/races/next/info');

const TEXT = {
  completedRaces: '\u5df2\u5b8c\u6210\u5206\u7ad9',
  activeDrivers: '\u6d3b\u8dc3\u8f66\u624b',
  activeConstructors: '\u6d3b\u8dc3\u8f66\u961f',
  daysUntilNextRace: '\u8ddd\u79bb\u4e0b\u4e00\u7ad9',
  seasonEnded: '\u8d5b\u5b63\u5df2\u7ed3\u675f',
  nextRace: '\u4e0b\u4e00\u573a\u6bd4\u8d5b',
  upcoming: '\u5373\u5c06\u5f00\u59cb',
  ongoingRace: '\u8fdb\u884c\u4e2d\u7684\u6bd4\u8d5b',
  live: '\u76f4\u64ad\u4e2d',
  standingsTopThree: '\u79ef\u5206\u699c TOP 3',
  driverStandings: '\u8f66\u624b\u79ef\u5206\u699c',
  constructorStandings: '\u8f66\u961f\u79ef\u5206\u699c',
  points: '\u79ef\u5206',
  gap: '\u5dee\u8ddd',
  leader: '\u9886\u5148',
  raceCircuit: '\u8d5b\u9053',
  raceLocation: '\u5730\u70b9',
  today: '\u4eca\u5929',
  loading: '\u6b63\u5728\u52a0\u8f7d\u9996\u9875\u6570\u636e...',
  staleData: '\u6570\u636e\u66f4\u65b0\u6682\u65f6\u5931\u8d25\uff0c\u5df2\u663e\u793a\u6700\u8fd1\u53ef\u7528\u6570\u636e',
  offlineData: '\u5f53\u524d\u79bb\u7ebf\uff0c\u5df2\u663e\u793a\u6700\u8fd1\u53ef\u7528\u6570\u636e',
  updatedAt: '\u66f4\u65b0\u4e8e',
  seasonPulse: '\u8d5b\u5b63\u8109\u640f',
  viewFullStandings: '\u67e5\u770b\u5b8c\u6574\u79ef\u5206\u699c',
  seasonProgress: '\u672c\u8d5b\u5b63\u5df2\u5b8c\u6210',
  racesUnit: '\u7ad9',
  driverLeader: '\u8f66\u624b\u699c\u9886\u5148',
  constructorLeader: '\u8f66\u961f\u699c\u9886\u5148',
  unavailable: '\u8d5b\u5b63\u6570\u636e\u6682\u65f6\u65e0\u6cd5\u52a0\u8f7d\uff0c\u8bf7\u68c0\u67e5\u7f51\u7edc\u540e\u91cd\u8bd5\u3002',
  retry: '\u91cd\u8bd5',
  moduleLoading: '\u6b63\u5728\u8865\u9f50\u6570\u636e...',
  moduleUnavailable: '\u8be5\u6570\u636e\u6682\u65f6\u4e0d\u53ef\u7528',
  moduleEmpty: '\u5f53\u524d\u8d5b\u5b63\u6682\u65e0\u79ef\u5206\u699c\u6570\u636e',
  controlRoom: '\u8d5b\u5b63\u6307\u6325\u5ba4',
  briefing: '\u4ece\u4e0b\u4e00\u7ad9\u3001\u51a0\u519b\u4e89\u593a\u5230\u6700\u65b0\u6392\u540d\uff0c\u4e00\u5c4f\u638c\u63e1\u5f53\u524d F1 \u8d5b\u5b63\u7684\u6700\u91cd\u8981\u4fe1\u53f7\u3002',
  seasonProgressShort: '\u8d5b\u5b63\u8fdb\u5ea6',
  nextSignal: '\u4e0b\u4e00\u4fe1\u53f7',
  noRace: '\u5df2\u5b8c\u8d5b',
};

const Home = () => {
  const navigate = useNavigate();
  const { currentSeason } = useAppStore();
  const {
    driverStandings,
    constructorStandings,
    races,
    loading,
    error,
    isOffline,
    isStale,
    updatedAt,
    refetch,
    resources,
  } = useSeasonDataCached(currentSeason);
  const { ongoingRace, nextRace, completedRaces } = useRacesByStatus(races);
  const driverLeaderPoints = driverStandings[0] ? parseFloat(driverStandings[0].points) : 0;
  const constructorLeaderPoints = constructorStandings[0] ? parseFloat(constructorStandings[0].points) : 0;
  const nextRaceDayDistance = nextRace ? daysUntilLocalDate(nextRace.date) : null;
  const daysUntilNextRace = nextRaceDayDistance === null ? null : Math.max(0, nextRaceDayDistance);

  if (loading) {
    return (
      <div className="page-container">
        <DocumentHead title="F1 Dashboard — 季节总览" description="Formula 1 data dashboard with race analytics, telemetry, and predictions" />
        <div className="home-skeleton" role="status" aria-label={TEXT.loading}>
          <div className="skeleton-card skeleton-card-pulse" />
          <div className="skeleton-line skeleton-line-short" />
          <div className="skeleton-card skeleton-card-hero" />
          <div className="skeleton-line skeleton-line-short" />
          <div className="skeleton-grid">
            <div className="skeleton-card" />
            <div className="skeleton-card" />
          </div>
        </div>
      </div>
    );
  }

  const hasAnySeasonData = races.length > 0 || driverStandings.length > 0 || constructorStandings.length > 0;

  if (error && !hasAnySeasonData) {
    return (
      <div className="page-container">
        <DocumentHead title="F1 Dashboard — 季节总览" description="Formula 1 data dashboard with race analytics, telemetry, and predictions" />
        <div className="home-error-state" role="alert">
          <strong>{TEXT.unavailable}</strong>
          <button type="button" onClick={refetch}>{TEXT.retry}</button>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      value: completedRaces.length,
      label: `${TEXT.completedRaces} / ${races.length}`,
      color: 'var(--f1-red)',
    },
    {
      value: driverStandings.length,
      label: TEXT.activeDrivers,
      color: 'var(--accent-blue)',
    },
    {
      value: constructorStandings.length,
      label: TEXT.activeConstructors,
      color: 'var(--accent-green)',
    },
    {
      value: daysUntilNextRace ?? '--',
      label: nextRace ? TEXT.daysUntilNextRace : TEXT.seasonEnded,
      color: 'var(--accent-yellow)',
    },
  ];

  const driverLeader = driverStandings[0];
  const constructorLeader = constructorStandings[0];

  const getRankBadgeClass = (index: number) => {
    if (index === 0) return 'rank-badge-1';
    if (index === 1) return 'rank-badge-2';
    if (index === 2) return 'rank-badge-3';
    return 'rank-badge-other';
  };

  const formatGap = (points: string, leaderPoints: number) => {
    const value = parseFloat(points);
    if (!Number.isFinite(value) || !Number.isFinite(leaderPoints) || value === leaderPoints) {
      return TEXT.leader;
    }

    return `-${(leaderPoints - value).toFixed(0)}`;
  };

  return (
    <div className="page-container">
      <DocumentHead title="F1 Dashboard — 季节总览" description="Formula 1 data dashboard with race analytics, telemetry, and predictions" />
      {(isOffline || isStale || (error && (races.length > 0 || driverStandings.length > 0))) ? (
        <div className="data-freshness-notice" role="status">
          <strong>{isOffline ? TEXT.offlineData : TEXT.staleData}</strong>
          {updatedAt ? <span>{TEXT.updatedAt} {formatLocalDateTime(updatedAt)}</span> : null}
          <button type="button" className="notice-retry" onClick={refetch}>{TEXT.retry}</button>
        </div>
      ) : null}
      <ProductMasthead
        index="00"
        eyebrow={`${currentSeason} / ${TEXT.controlRoom}`}
        title={<>{currentSeason}<br />SEASON CONTROL</>}
        description={TEXT.briefing}
        actions={(
          <>
            <button type="button" className="home-command-primary" onPointerEnter={() => preloadRoute('/races')} onFocus={() => preloadRoute('/races')} onClick={() => navigate('/races')}>
              {TEXT.nextRace}
            </button>
            <button type="button" className="home-command-secondary" onPointerEnter={() => preloadRoute('/seasons')} onFocus={() => preloadRoute('/seasons')} onClick={() => navigate('/seasons')}>
              {TEXT.viewFullStandings}
            </button>
          </>
        )}
        metrics={[
          {
            label: TEXT.seasonProgressShort,
            value: `${completedRaces.length}/${races.length || '--'}`,
            detail: `${TEXT.completedRaces} · ${Math.round((completedRaces.length / Math.max(races.length, 1)) * 100)}%`,
          },
          {
            label: TEXT.driverLeader,
            value: driverLeader ? `${driverLeader.Driver.givenName[0]}. ${driverLeader.Driver.familyName}` : '--',
            detail: driverLeader ? `${driverLeader.points} PTS` : TEXT.moduleLoading,
            accent: driverLeader?.Constructors[0]
              ? getTeamColor(driverLeader.Constructors[0].constructorId)
              : undefined,
          },
          {
            label: TEXT.constructorLeader,
            value: constructorLeader?.Constructor.name || '--',
            detail: constructorLeader ? `${constructorLeader.points} PTS` : TEXT.moduleLoading,
            accent: constructorLeader ? getTeamColor(constructorLeader.Constructor.constructorId) : undefined,
          },
          {
            label: TEXT.nextSignal,
            value: nextRace ? (daysUntilNextRace === 0 ? TEXT.today : `T-${daysUntilNextRace}`) : TEXT.noRace,
            detail: nextRace?.raceName || TEXT.seasonEnded,
            accent: 'var(--accent-yellow)',
          },
        ]}
      />
      {(driverLeader || constructorLeader || races.length > 0) ? (
        <section className="season-pulse home-deferred-section home-deferred-section--compact" aria-labelledby="season-pulse-title">
          <div>
            <span className="season-pulse-kicker" id="season-pulse-title">{TEXT.seasonPulse}</span>
            <p>
              {TEXT.seasonProgress} <strong>{completedRaces.length}/{races.length} {TEXT.racesUnit}</strong>
              {driverLeader ? <> · {TEXT.driverLeader} <strong>{driverLeader.Driver.givenName} {driverLeader.Driver.familyName}</strong></> : null}
              {constructorLeader ? <> · {TEXT.constructorLeader} <strong>{constructorLeader.Constructor.name}</strong></> : null}
            </p>
          </div>
          <button type="button" className="standings-cta" onPointerEnter={() => preloadRoute('/seasons')} onFocus={() => preloadRoute('/seasons')} onClick={() => navigate('/seasons')}>
            {TEXT.viewFullStandings}
          </button>
        </section>
      ) : null}
      {nextRace ? (
        <section className="next-race-section home-deferred-section home-deferred-section--medium">
          <h2 className="section-title-f1">
            <span className="section-title-accent section-title-accent-warning" />
            {TEXT.nextRace}
          </h2>
          <button
            type="button"
            className="next-race-card-f1"
            onClick={() => navigate(
              `/races/${nextRace.round}/info?season=${encodeURIComponent(nextRace.season)}`,
            )}
            onPointerEnter={preloadRaceInfoRoute}
            onFocus={preloadRaceInfoRoute}
          >
            <div className="next-race-content-f1">
              <div className="next-race-info-f1">
                <div className="next-race-title">{nextRace.raceName}</div>
                <p className="next-race-circuit">
                  {TEXT.raceCircuit}: {nextRace.Circuit.circuitName}
                </p>
                <p className="next-race-location">
                  {TEXT.raceLocation}: {nextRace.Circuit.Location.locality}, {nextRace.Circuit.Location.country}
                </p>
                <div className="next-race-date">
                  {formatRaceDateTimeFull(nextRace)}
                  <span className="countdown">
                    {daysUntilNextRace === 0 ? TEXT.today : `\u8fd8\u6709 ${daysUntilNextRace} \u5929`}
                  </span>
                </div>
              </div>
              <span className="next-race-tag">{TEXT.upcoming}</span>
            </div>
          </button>
        </section>
      ) : null}

      {ongoingRace ? (
        <section className="ongoing-section home-deferred-section home-deferred-section--medium">
          <h2 className="section-title-f1">
            <span className="section-title-accent section-title-accent-live" />
            {TEXT.ongoingRace}
          </h2>
          <button
            type="button"
            className="ongoing-card-f1"
            onClick={() => navigate(
              `/races/${ongoingRace.round}/race?season=${encodeURIComponent(ongoingRace.season)}`,
            )}
            onPointerEnter={() => preloadRoute(`/races/${ongoingRace.round}/race`)}
            onFocus={() => preloadRoute(`/races/${ongoingRace.round}/race`)}
          >
            <div className="ongoing-content-f1">
              <div className="ongoing-info-f1">
                <div className="ongoing-race-title">{ongoingRace.raceName}</div>
                <p>
                  {ongoingRace.Circuit.circuitName}, {ongoingRace.Circuit.Location.locality}, {ongoingRace.Circuit.Location.country}
                </p>
              </div>
              <span className="ongoing-tag">{TEXT.live}</span>
            </div>
          </button>
        </section>
      ) : null}

      <div className="section-divider" />

      <section className="standings-section home-deferred-section home-deferred-section--large">
        <div className="section-heading-row">
          <h2 className="section-title-f1">
            <span className="section-title-accent section-title-accent-primary" />
            {TEXT.standingsTopThree}
          </h2>
          <button type="button" className="standings-inline-link" onPointerEnter={() => preloadRoute('/seasons')} onFocus={() => preloadRoute('/seasons')} onClick={() => navigate('/seasons')}>
            {TEXT.viewFullStandings}
          </button>
        </div>

        <div className="standings-grid">
          <div className="standings-card-f1 official-standings-card">
            <div className="official-standings-header">
              <span>{TEXT.driverStandings}</span>
              <strong>{TEXT.points}</strong>
            </div>
            <div className="standings-list-f1">
              {resources.drivers.loading && driverStandings.length === 0 ? (
                <div className="standings-module-state">{TEXT.moduleLoading}</div>
              ) : resources.drivers.error && driverStandings.length === 0 ? (
                <div className="standings-module-state is-error">{TEXT.moduleUnavailable}</div>
              ) : driverStandings.length === 0 ? (
                <div className="standings-module-state">{TEXT.moduleEmpty}</div>
              ) : null}
              {driverStandings.slice(0, 3).map((item, index) => {
                const constructor = item.Constructors[0];
                const teamColor = getTeamColor(constructor?.constructorId || 'unknown');

                return (
                <div
                  key={item.Driver.driverId}
                  className="standings-item-f1 official-standings-row"
                  style={{ '--row-team-color': teamColor } as CSSProperties}
                >
                  <div className={`rank-badge ${getRankBadgeClass(index)}`}>
                    {item.position}
                  </div>
                  <div className="standings-info-f1">
                    <button
                      type="button"
                      className="standings-link-f1 standings-name-f1 clickable-f1"
                      onPointerEnter={() => preloadRoute(`/drivers/${item.Driver.driverId}`)}
                      onFocus={() => preloadRoute(`/drivers/${item.Driver.driverId}`)}
                      onClick={() => navigate(`/drivers/${item.Driver.driverId}`)}
                    >
                      {item.Driver.givenName} {item.Driver.familyName}
                    </button>
                    <button
                      type="button"
                      className="standings-link-f1 standings-team-f1 clickable-f1"
                      disabled={!constructor}
                      onPointerEnter={() => constructor && preloadRoute(`/constructors/${constructor.constructorId}`)}
                      onFocus={() => constructor && preloadRoute(`/constructors/${constructor.constructorId}`)}
                      onClick={() => constructor && navigate(`/constructors/${constructor.constructorId}`)}
                    >
                      {constructor?.name || '-'}
                    </button>
                    <span className="standings-gap-f1">
                      {TEXT.gap}: {formatGap(item.points, driverLeaderPoints)}
                    </span>
                  </div>
                  <div className="standings-points-f1">
                    {item.points}
                    <span className="points-unit">pts</span>
                  </div>
                </div>
                );
              })}
            </div>
          </div>

          <div className="standings-card-f1 official-standings-card">
            <div className="official-standings-header">
              <span>{TEXT.constructorStandings}</span>
              <strong>{TEXT.points}</strong>
            </div>
            <div className="standings-list-f1">
              {resources.constructors.loading && constructorStandings.length === 0 ? (
                <div className="standings-module-state">{TEXT.moduleLoading}</div>
              ) : resources.constructors.error && constructorStandings.length === 0 ? (
                <div className="standings-module-state is-error">{TEXT.moduleUnavailable}</div>
              ) : constructorStandings.length === 0 ? (
                <div className="standings-module-state">{TEXT.moduleEmpty}</div>
              ) : null}
              {constructorStandings.slice(0, 3).map((item, index) => {
                const teamColor = getTeamColor(item.Constructor.constructorId);

                return (
                <div
                  key={item.Constructor.constructorId}
                  className="standings-item-f1 official-standings-row"
                  style={{ '--row-team-color': teamColor } as CSSProperties}
                >
                  <div className={`rank-badge ${getRankBadgeClass(index)}`}>
                    {item.position}
                  </div>
                  <div className="standings-info-f1">
                    <button
                      type="button"
                      className="standings-link-f1 standings-name-f1 clickable-f1"
                      onPointerEnter={() => preloadRoute(`/constructors/${item.Constructor.constructorId}`)}
                      onFocus={() => preloadRoute(`/constructors/${item.Constructor.constructorId}`)}
                      onClick={() => navigate(`/constructors/${item.Constructor.constructorId}`)}
                    >
                      {item.Constructor.name}
                    </button>
                    <div className="standings-team-f1">
                      {item.Constructor.nationality}
                    </div>
                    <span className="standings-gap-f1">
                      {TEXT.gap}: {formatGap(item.points, constructorLeaderPoints)}
                    </span>
                  </div>
                  <div className="standings-points-f1">
                    {item.points}
                    <span className="points-unit">pts</span>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      <section className="stats-grid home-deferred-section home-deferred-section--compact">
        {statCards.map((card, index) => (
        <div
          key={index}
          className="stat-card-f1"
        >
          <div className="stat-value" style={{ color: card.color }}>
            {card.value}
          </div>
            <div className="stat-label">{card.label}</div>
          </div>
        ))}
      </section>
    </div>
  );
};

export default Home;
