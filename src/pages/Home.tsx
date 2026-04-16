import { useNavigate } from 'react-router-dom';
import { Card, Spin, List, Tag } from 'antd';
import { TrophyOutlined, CarOutlined, TeamOutlined, ClockCircleOutlined, FireOutlined } from '@ant-design/icons';
import { useAppStore } from '@/store';
import { useSeasonData, useRacesByStatus } from '@/hooks';
import dayjs from 'dayjs';
import './Home.css';

const Home = () => {
  const navigate = useNavigate();
  const { currentSeason } = useAppStore();
  const { driverStandings, constructorStandings, races, loading } = useSeasonData(currentSeason);
  const { ongoingRace, nextRace, completedRaces } = useRacesByStatus(races);

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-container">
          <Spin size="large" />
        </div>
      </div>
    );
  }

  const statCards = [
    {
      icon: <TrophyOutlined className="stat-icon" style={{ color: 'var(--f1-red)' }} />,
      value: completedRaces.length,
      label: `已完成分站赛 / ${races.length}`,
      color: 'var(--f1-red)',
      delay: 'stagger-1'
    },
    {
      icon: <CarOutlined className="stat-icon" style={{ color: 'var(--accent-blue)' }} />,
      value: driverStandings.length,
      label: '参赛车手',
      color: 'var(--accent-blue)',
      delay: 'stagger-2'
    },
    {
      icon: <TeamOutlined className="stat-icon" style={{ color: 'var(--accent-green)' }} />,
      value: constructorStandings.length,
      label: '参赛车队',
      color: 'var(--accent-green)',
      delay: 'stagger-3'
    },
    {
      icon: <ClockCircleOutlined className="stat-icon" style={{ color: 'var(--accent-yellow)' }} />,
      value: nextRace ? dayjs(nextRace.date).diff(dayjs(), 'day') : '✓',
      label: nextRace ? 'days until next race' : 'Season ended',
      color: 'var(--accent-yellow)',
      delay: 'stagger-4'
    }
  ];

  const getRankBadgeClass = (index: number) => {
    if (index === 0) return 'rank-badge-1';
    if (index === 1) return 'rank-badge-2';
    if (index === 2) return 'rank-badge-3';
    return 'rank-badge-other';
  };

  return (
    <div className="page-container">


      {/* Next Race Preview - First */}
      {nextRace && (
        <section className="next-race-section animate-slide-up">
          <h2 className="section-title-f1">
            <ClockCircleOutlined style={{ marginRight: 12, color: 'var(--accent-yellow)' }} />
            下一场比赛
          </h2>
          <Card
            className="next-race-card-f1"
            hoverable
            onClick={() => navigate(`/races/${nextRace.round}`)}
          >
            <div className="next-race-content-f1">
              <div className="next-race-info-f1">
                <h3>{nextRace.raceName}</h3>
                <p className="next-race-circuit">
                  {nextRace.Circuit.circuitName}
                </p>
                <p className="next-race-location">
                  {nextRace.Circuit.Location.locality}, {nextRace.Circuit.Location.country}
                </p>
                <div className="next-race-date">
                  <ClockCircleOutlined style={{ marginRight: 6 }} />
                  {dayjs(nextRace.date).format('YYYY-MM-DD')}
                  <span className="countdown">
                    ({dayjs(nextRace.date).diff(dayjs(), 'day')} days away)
                  </span>
                </div>
              </div>
              <Tag className="next-race-tag" color="gold">
                即将开赛
              </Tag>
            </div>
          </Card>
        </section>
      )}

      {/* Ongoing Race */}
      {ongoingRace && (
        <section className="ongoing-section animate-slide-up">
          <h2 className="section-title-f1">
            <FireOutlined style={{ marginRight: 12, color: 'var(--accent-orange)' }} />
            进行中比赛
          </h2>
          <Card className="ongoing-card-f1">
            <div className="ongoing-content-f1">
              <div className="ongoing-info-f1">
                <h3>{ongoingRace.raceName}</h3>
                <p>
                  {ongoingRace.Circuit.circuitName} · {ongoingRace.Circuit.Location.locality}, {ongoingRace.Circuit.Location.country}
                </p>
              </div>
              <Tag className="ongoing-tag">
                <FireOutlined /> 进行中
              </Tag>
            </div>
          </Card>
        </section>
      )}

      <div className="section-divider" />

      {/* Standings Section - Second */}
      <section className="standings-section">
        <h2 className="section-title-f1 animate-slide-up stagger-5">
          <TrophyOutlined style={{ marginRight: 12, color: 'var(--f1-red)' }} />
          积分榜 TOP3
        </h2>

        <div className="standings-grid">
          {/* Driver Standings */}
          <div className="standings-card-f1 animate-slide-up stagger-5">
            <div className="card-header">
              <CarOutlined style={{ marginRight: 8 }} />
              车手积分榜
            </div>
            <List
              className="standings-list-f1"
              dataSource={driverStandings.slice(0, 3)}
              renderItem={(item, index) => (
                <List.Item className="standings-item-f1">
                  <div className={`rank-badge ${getRankBadgeClass(index)}`}>
                    {index + 1}
                  </div>
                  <div className="standings-info-f1">
                    <div
                      className="standings-name-f1 clickable-f1"
                      onClick={() => navigate(`/drivers/${item.Driver.driverId}`)}
                    >
                      {item.Driver.givenName} {item.Driver.familyName}
                    </div>
                    <div
                      className="standings-team-f1 clickable-f1"
                      onClick={() => navigate(`/constructors/${item.Constructors[0].constructorId}`)}
                    >
                      {item.Constructors[0].name}
                    </div>
                  </div>
                  <div className="standings-points-f1" style={{ color: 'var(--f1-red)' }}>
                    {item.points}
                    <span className="points-unit">pts</span>
                  </div>
                </List.Item>
              )}
            />
          </div>

          {/* Constructor Standings */}
          <div className="standings-card-f1 animate-slide-up stagger-6">
            <div className="card-header">
              <TeamOutlined style={{ marginRight: 8 }} />
              车队积分榜
            </div>
            <List
              className="standings-list-f1"
              dataSource={constructorStandings.slice(0, 3)}
              renderItem={(item, index) => (
                <List.Item className="standings-item-f1">
                  <div className={`rank-badge ${getRankBadgeClass(index)}`}>
                    {index + 1}
                  </div>
                  <div className="standings-info-f1">
                    <div
                      className="standings-name-f1 clickable-f1"
                      onClick={() => navigate(`/constructors/${item.Constructor.constructorId}`)}
                    >
                      {item.Constructor.name}
                    </div>
                    <div className="standings-team-f1">
                      {item.Constructor.nationality}
                    </div>
                  </div>
                  <div className="standings-points-f1" style={{ color: 'var(--f1-red)' }}>
                    {item.points}
                    <span className="points-unit">pts</span>
                  </div>
                </List.Item>
              )}
            />
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* Stats Grid - Last */}
      <section className="stats-grid">
        {statCards.map((card, index) => (
          <div
            key={index}
            className={`stat-card-f1 animate-slide-up ${card.delay}`}
          >
            {card.icon}
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
