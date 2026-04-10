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
      <div className="home-page-container">
        <div className="loading-container">
          <Spin size="large" />
        </div>
      </div>
    );
  }

  return (
    <div className="home-page-container">
      <h1 className="page-title">🏎️ <span>{currentSeason}赛季 F1 概览</span></h1>
      <p className="page-subtitle">欢迎来到F1数据看板，查看最新赛事数据和历史记录</p>

      <div className="stats-container">
        <Card className="stat-card">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <TrophyOutlined style={{ fontSize: 32, color: '#ff1801', marginBottom: 12 }} />
            <div style={{ fontSize: 36, fontWeight: 800, color: '#ff1801' }}>
              {completedRaces.length}
            </div>
            <div style={{ fontSize: 14, color: '#8c8c8c', marginTop: 4 }}>
              已完成分站赛 / {races.length}
            </div>
          </div>
        </Card>

        <Card className="stat-card">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <CarOutlined style={{ fontSize: 32, color: '#1890ff', marginBottom: 12 }} />
            <div style={{ fontSize: 36, fontWeight: 800, color: '#1890ff' }}>
              {driverStandings.length}
            </div>
            <div style={{ fontSize: 14, color: '#8c8c8c', marginTop: 4 }}>
              参赛车手
            </div>
          </div>
        </Card>

        <Card className="stat-card">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <TeamOutlined style={{ fontSize: 32, color: '#52c41a', marginBottom: 12 }} />
            <div style={{ fontSize: 36, fontWeight: 800, color: '#52c41a' }}>
              {constructorStandings.length}
            </div>
            <div style={{ fontSize: 14, color: '#8c8c8c', marginTop: 4 }}>
              参赛车队
            </div>
          </div>
        </Card>

        <Card className="stat-card">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <ClockCircleOutlined style={{ fontSize: 32, color: '#faad14', marginBottom: 12 }} />
            <div style={{ fontSize: 36, fontWeight: 800, color: '#faad14' }}>
              {nextRace ? dayjs(nextRace.date).diff(dayjs(), 'day') : '✓'}
            </div>
            <div style={{ fontSize: 14, color: '#8c8c8c', marginTop: 4 }}>
              {nextRace ? '天后下一场比赛' : '赛季已结束'}
            </div>
          </div>
        </Card>
      </div>

      <h2 className="section-title">🏆 积分榜 TOP3</h2>
      <div className="standings-container">
        <Card className="standings-card" title="车手积分榜">
          <List
            className="standings-list"
            dataSource={driverStandings.slice(0, 3)}
            renderItem={(item, index) => (
              <List.Item className="standings-item">
                <div className={`standings-rank standings-rank-${index + 1}`}>
                  {index + 1}
                </div>
                <div className="standings-info">
                  <div
                    className="standings-name"
                    onClick={() => navigate(`/drivers/${item.Driver.driverId}`)}
                  >
                    {item.Driver.givenName} {item.Driver.familyName}
                    <Tag color="blue" style={{ marginLeft: 8, fontSize: 12 }}>
                      {item.Driver.code}
                    </Tag>
                  </div>
                  <div
                    className="standings-sub"
                    onClick={() => navigate(`/constructors/${item.Constructors[0].constructorId}`)}
                  >
                    {item.Constructors[0].name}
                  </div>
                </div>
                <div className="standings-points">
                  {item.points} pts
                </div>
              </List.Item>
            )}
          />
        </Card>

        <Card className="standings-card" title="车队积分榜">
          <List
            className="standings-list"
            dataSource={constructorStandings.slice(0, 3)}
            renderItem={(item, index) => (
              <List.Item className="standings-item">
                <div className={`standings-rank standings-rank-${index + 1}`}>
                  {index + 1}
                </div>
                <div className="standings-info">
                  <div
                    className="standings-name"
                    onClick={() => navigate(`/constructors/${item.Constructor.constructorId}`)}
                  >
                    {item.Constructor.name}
                  </div>
                  <div className="standings-sub">
                    {item.Constructor.nationality}
                  </div>
                </div>
                <div className="standings-points">
                  {item.points} pts
                </div>
              </List.Item>
            )}
          />
        </Card>
      </div>

      {ongoingRace && (
        <>
          <h2 className="section-title">🔥 进行中比赛</h2>
          <Card className="ongoing-card">
            <div className="ongoing-content">
              <div className="ongoing-info">
                <h3>{ongoingRace.raceName}</h3>
                <p>
                  {ongoingRace.Circuit.circuitName} · {ongoingRace.Circuit.Location.locality}, {ongoingRace.Circuit.Location.country}
                </p>
              </div>
              <Tag color="orange" icon={<FireOutlined />} style={{ fontSize: 14, padding: '6px 16px', borderRadius: 20 }}>
                进行中
              </Tag>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

export default Home;
