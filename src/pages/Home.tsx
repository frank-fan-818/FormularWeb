import { useNavigate } from 'react-router-dom';
import type { CSSProperties } from 'react';
import dayjs from 'dayjs';
import { useSeasonData, useRacesByStatus } from '@/hooks';
import { useAppStore } from '@/store';
import { formatRaceDateTimeFull } from '@/utils/raceSchedule';
import { getTeamColor } from '@/utils/teamColors';
import './Home.css';

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
};

const Home = () => {
  const navigate = useNavigate();
  const { currentSeason } = useAppStore();
  const { driverStandings, constructorStandings, races, loading } = useSeasonData(currentSeason);
  const { ongoingRace, nextRace, completedRaces } = useRacesByStatus(races);
  const driverLeaderPoints = driverStandings[0] ? parseFloat(driverStandings[0].points) : 0;
  const constructorLeaderPoints = constructorStandings[0] ? parseFloat(constructorStandings[0].points) : 0;
  const daysUntilNextRace = nextRace
    ? Math.max(0, dayjs(nextRace.date).startOf('day').diff(dayjs().startOf('day'), 'day'))
    : null;

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-loader">
          <div className="page-loader-spinner" />
          <span>{TEXT.loading}</span>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      value: completedRaces.length,
      label: `${TEXT.completedRaces} / ${races.length}`,
      color: 'var(--f1-red)',
      delay: 'stagger-1',
    },
    {
      value: driverStandings.length,
      label: TEXT.activeDrivers,
      color: 'var(--accent-blue)',
      delay: 'stagger-2',
    },
    {
      value: constructorStandings.length,
      label: TEXT.activeConstructors,
      color: 'var(--accent-green)',
      delay: 'stagger-3',
    },
    {
      value: daysUntilNextRace ?? '--',
      label: nextRace ? TEXT.daysUntilNextRace : TEXT.seasonEnded,
      color: 'var(--accent-yellow)',
      delay: 'stagger-4',
    },
  ];

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
      {nextRace ? (
        <section className="next-race-section animate-slide-up">
          <h2 className="section-title-f1">
            <span className="section-title-accent section-title-accent-warning" />
            {TEXT.nextRace}
          </h2>
          <button
            type="button"
            className="next-race-card-f1"
            onClick={() => navigate(`/races/${nextRace.round}`)}
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
        <section className="ongoing-section animate-slide-up">
          <h2 className="section-title-f1">
            <span className="section-title-accent section-title-accent-live" />
            {TEXT.ongoingRace}
          </h2>
          <div className="ongoing-card-f1">
            <div className="ongoing-content-f1">
              <div className="ongoing-info-f1">
                <div className="ongoing-race-title">{ongoingRace.raceName}</div>
                <p>
                  {ongoingRace.Circuit.circuitName}, {ongoingRace.Circuit.Location.locality}, {ongoingRace.Circuit.Location.country}
                </p>
              </div>
              <span className="ongoing-tag">{TEXT.live}</span>
            </div>
          </div>
        </section>
      ) : null}

      <div className="section-divider" />

      <section className="standings-section">
        <h2 className="section-title-f1 animate-slide-up stagger-5">
          <span className="section-title-accent section-title-accent-primary" />
          {TEXT.standingsTopThree}
        </h2>

        <div className="standings-grid">
          <div className="standings-card-f1 official-standings-card animate-slide-up stagger-5">
            <div className="official-standings-header">
              <span>{TEXT.driverStandings}</span>
              <strong>{TEXT.points}</strong>
            </div>
            <div className="standings-list-f1">
              {driverStandings.slice(0, 3).map((item, index) => {
                const teamColor = getTeamColor(item.Constructors[0].constructorId);

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
                      onClick={() => navigate(`/drivers/${item.Driver.driverId}`)}
                    >
                      {item.Driver.givenName} {item.Driver.familyName}
                    </button>
                    <button
                      type="button"
                      className="standings-link-f1 standings-team-f1 clickable-f1"
                      onClick={() => navigate(`/constructors/${item.Constructors[0].constructorId}`)}
                    >
                      {item.Constructors[0].name}
                    </button>
                    <span className="standings-gap-f1">
                      {TEXT.gap}: {formatGap(item.points, driverLeaderPoints)}
                    </span>
                  </div>
                  <div className="standings-points-f1" style={{ color: 'var(--f1-red)' }}>
                    {item.points}
                    <span className="points-unit">pts</span>
                  </div>
                </div>
                );
              })}
            </div>
          </div>

          <div className="standings-card-f1 official-standings-card animate-slide-up stagger-6">
            <div className="official-standings-header">
              <span>{TEXT.constructorStandings}</span>
              <strong>{TEXT.points}</strong>
            </div>
            <div className="standings-list-f1">
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
                  <div className="standings-points-f1" style={{ color: 'var(--f1-red)' }}>
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

      <section className="stats-grid">
        {statCards.map((card, index) => (
        <div
          key={index}
          className={`stat-card-f1 animate-slide-up ${card.delay}`}
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
