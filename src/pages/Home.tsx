import { useNavigate } from 'react-router-dom';
import type { CSSProperties } from 'react';
import DocumentHead from '@/components/DocumentHead';
import { useSeasonDataCached } from '@/hooks/useSeasonDataCached';
import { useRacesByStatus } from '@/hooks/useRaceStatus';
import { useAppStore } from '@/store';
import { formatRaceDateTimeFull, getRaceWeekendTimeline } from '@/utils/raceSchedule';
import { formatLocalDateTime } from '@/utils/dateTime';
import { getTeamColor } from '@/utils/teamColors';
import { buildSeasonSummary } from '@/utils/seasonSummary';

const preloadRoute = (pathname: string) => {
  void import('@/utils/routePreload').then((module) => module.preloadRoute(pathname));
};

const TEXT = {
  seasonEnded: '\u8d5b\u5b63\u5df2\u7ed3\u675f',
  nextRace: '\u4e0b\u4e00\u7ad9',
  ongoingRace: '\u5f53\u524d\u8d5b\u5468',
  live: '\u8fdb\u884c\u4e2d',
  standingsTopThree: '\u79ef\u5206\u699c TOP 3',
  driverStandings: '\u8f66\u624b\u79ef\u5206\u699c',
  constructorStandings: '\u8f66\u961f\u79ef\u5206\u699c',
  points: '\u79ef\u5206',
  gap: '\u5dee\u8ddd',
  leader: '\u9886\u5148',
  loading: '\u6b63\u5728\u52a0\u8f7d\u9996\u9875\u6570\u636e...',
  staleData: '\u6570\u636e\u66f4\u65b0\u6682\u65f6\u5931\u8d25\uff0c\u5df2\u663e\u793a\u6700\u8fd1\u53ef\u7528\u6570\u636e',
  offlineData: '\u5f53\u524d\u79bb\u7ebf\uff0c\u5df2\u663e\u793a\u6700\u8fd1\u53ef\u7528\u6570\u636e',
  updatedAt: '\u66f4\u65b0\u4e8e',
  viewFullStandings: '\u67e5\u770b\u5b8c\u6574\u79ef\u5206\u699c',
  driverLeader: '\u8f66\u624b\u699c',
  constructorLeader: '\u8f66\u961f\u699c',
  unavailable: '\u8d5b\u5b63\u6570\u636e\u6682\u65f6\u65e0\u6cd5\u52a0\u8f7d\uff0c\u8bf7\u68c0\u67e5\u7f51\u7edc\u540e\u91cd\u8bd5\u3002',
  retry: '\u91cd\u8bd5',
  moduleLoading: '\u6b63\u5728\u8865\u9f50\u6570\u636e...',
  moduleUnavailable: '\u8be5\u6570\u636e\u6682\u65f6\u4e0d\u53ef\u7528',
  moduleEmpty: '\u5f53\u524d\u8d5b\u5b63\u6682\u65e0\u79ef\u5206\u699c\u6570\u636e',
  seasonProgress: '\u8d5b\u5b63\u8fdb\u5ea6',
  latestCompleted: '\u6700\u8fd1\u5b8c\u8d5b',
  weekendSchedule: '\u8d5b\u5468\u65e5\u7a0b',
  viewRace: '\u67e5\u770b\u8d5b\u4e8b',
  fullCalendar: '\u5b8c\u6574\u8d5b\u5386',
};

const WEEKEND_LABELS = {
  fp1: '\u4e00\u7ec3',
  fp2: '\u4e8c\u7ec3',
  fp3: '\u4e09\u7ec3',
  qualifying: '\u6392\u4f4d\u8d5b',
  sprintQualifying: '\u51b2\u523a\u6392\u4f4d',
  sprint: '\u51b2\u523a\u8d5b',
  race: '\u6b63\u8d5b',
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
  const { ongoingRace, nextRace } = useRacesByStatus(races);
  const driverLeaderPoints = driverStandings[0] ? parseFloat(driverStandings[0].points) : 0;
  const constructorLeaderPoints = constructorStandings[0] ? parseFloat(constructorStandings[0].points) : 0;

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

  const driverLeader = driverStandings[0];
  const constructorLeader = constructorStandings[0];
  const seasonSummary = buildSeasonSummary(races, driverStandings, constructorStandings);
  const focusRace = ongoingRace ?? nextRace;
  const weekendTimeline = getRaceWeekendTimeline(focusRace ?? null, WEEKEND_LABELS);
  const focusRacePath = focusRace
    ? `/races/${focusRace.round}/info?season=${encodeURIComponent(focusRace.season)}`
    : '/races';

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
      <section className="home-command-surface" aria-labelledby="home-command-title">
        <div className="home-command-status">
          <span>{currentSeason} SEASON</span>
          <span className={ongoingRace ? 'is-live' : ''}>
            <i />{ongoingRace ? TEXT.ongoingRace : focusRace ? TEXT.nextRace : TEXT.seasonEnded}
          </span>
        </div>

        <div className="home-command-lead">
          <div>
            <h1 id="home-command-title">{focusRace?.raceName || `${currentSeason} ${TEXT.seasonEnded}`}</h1>
            {focusRace ? (
              <p>
                <strong>{focusRace.Circuit.circuitName}</strong>
                <span>{focusRace.Circuit.Location.locality} · {focusRace.Circuit.Location.country}</span>
              </p>
            ) : null}
            <time>{focusRace ? formatRaceDateTimeFull(focusRace) : `${seasonSummary.completedRounds}/${seasonSummary.totalRounds}`}</time>
          </div>
          <div className="home-command-actions">
            <button
              type="button"
              className="home-command-primary"
              onPointerEnter={() => preloadRoute(focusRacePath)}
              onFocus={() => preloadRoute(focusRacePath)}
              onClick={() => navigate(focusRacePath)}
            >
              {focusRace ? TEXT.viewRace : TEXT.fullCalendar}
            </button>
            <button
              type="button"
              className="home-command-secondary"
              onPointerEnter={() => preloadRoute('/seasons')}
              onFocus={() => preloadRoute('/seasons')}
              onClick={() => navigate('/seasons')}
            >
              {TEXT.viewFullStandings}
            </button>
          </div>
        </div>

        <dl className="home-core-facts">
          <div>
            <dt>{TEXT.seasonProgress}</dt>
            <dd>{seasonSummary.completedRounds}/{seasonSummary.totalRounds || '--'}</dd>
            <span>{seasonSummary.remainingRounds} 站未完成</span>
          </div>
          <div style={{ '--fact-accent': driverLeader?.Constructors[0] ? getTeamColor(driverLeader.Constructors[0].constructorId) : undefined } as CSSProperties}>
            <dt>{TEXT.driverLeader}</dt>
            <dd>{driverLeader ? `${driverLeader.Driver.givenName[0]}. ${driverLeader.Driver.familyName}` : '--'}</dd>
            <span>{driverLeader
              ? `${driverLeader.points} PTS${seasonSummary.driverGap === null ? '' : ` · +${seasonSummary.driverGap}`}`
              : resources.drivers.loading
                ? TEXT.moduleLoading
                : resources.drivers.error ? TEXT.moduleUnavailable : TEXT.moduleEmpty}</span>
          </div>
          <div style={{ '--fact-accent': constructorLeader ? getTeamColor(constructorLeader.Constructor.constructorId) : undefined } as CSSProperties}>
            <dt>{TEXT.constructorLeader}</dt>
            <dd>{constructorLeader?.Constructor.name || '--'}</dd>
            <span>{constructorLeader
              ? `${constructorLeader.points} PTS${seasonSummary.constructorGap === null ? '' : ` · +${seasonSummary.constructorGap}`}`
              : resources.constructors.loading
                ? TEXT.moduleLoading
                : resources.constructors.error ? TEXT.moduleUnavailable : TEXT.moduleEmpty}</span>
          </div>
          <div>
            <dt>{TEXT.latestCompleted}</dt>
            <dd>{seasonSummary.latestCompletedRace?.raceName || '--'}</dd>
            {seasonSummary.latestCompletedRace ? (
              <button
                type="button"
                onClick={() => navigate(`/races/${seasonSummary.latestCompletedRace?.round}/results?season=${encodeURIComponent(currentSeason)}`)}
              >
                R{seasonSummary.latestCompletedRace.round} · 查看结果
              </button>
            ) : <span>--</span>}
          </div>
        </dl>

        {weekendTimeline.length > 0 ? (
          <div className="home-weekend-schedule" aria-label={TEXT.weekendSchedule}>
            <div className="home-weekend-heading">
              <h2>{TEXT.weekendSchedule}</h2>
              <span>北京时间</span>
            </div>
            <div className="home-weekend-sessions">
              {weekendTimeline.slice(0, 5).map((session) => (
                <div key={session.key} className={`home-weekend-session is-${session.state} ${session.isNext ? 'is-next' : ''}`}>
                  <span>{session.code}</span>
                  <strong>{session.label}</strong>
                  <time>{session.timeLabel}</time>
                  <small>{session.state === 'live' ? TEXT.live : session.state === 'completed' ? '\u5df2\u7ed3\u675f' : session.isNext ? '\u4e0b\u4e00\u573a' : '\u672a\u5f00\u59cb'}</small>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

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

    </div>
  );
};

export default Home;
