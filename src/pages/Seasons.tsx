import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Tabs, Spin, Tag, Progress } from 'antd';
import { TrophyOutlined } from '@ant-design/icons';
import { useAppStore } from '@/store';
import { seasonApi } from '@/api/ergast';
import { getTeamColor } from '@/utils/teamColors';
import type { DriverStanding, ConstructorStanding } from '@/types';
import './Seasons.css';

const Seasons = () => {
  const navigate = useNavigate();
  const { currentSeason } = useAppStore();
  const [driverStandings, setDriverStandings] = useState<DriverStanding[]>([]);
  const [constructorStandings, setConstructorStandings] = useState<ConstructorStanding[]>([]);
  const [loading, setLoading] = useState(false);
  // 计算榜首积分，用于进度条比例
  const maxDriverPoints = driverStandings[0] ? parseFloat(driverStandings[0].points) : 0;
  const maxConstructorPoints = constructorStandings[0] ? parseFloat(constructorStandings[0].points) : 0;

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const [drivers, constructors] = await Promise.all([
        seasonApi.getDriverStandings(currentSeason),
        seasonApi.getConstructorStandings(currentSeason),
      ]);
      setDriverStandings(drivers);
      setConstructorStandings(constructors);
      setLoading(false);
    };
    loadData();
  }, [currentSeason]);

  const tabItems = [
    {
      key: 'drivers',
      label: '车手积分榜',
      children: (
        <div className="list-container">
          {driverStandings.map((standing, index) => {
            const teamColor = getTeamColor(standing.Constructors[0].constructorId);
            const points = parseFloat(standing.points);
            const percentage = maxDriverPoints > 0 ? Math.min(100, (points / maxDriverPoints) * 100) : 0;
            return (
              <Card
                key={standing.Driver.driverId}
                className="list-item"
                hoverable
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="team-color-bar" style={{ backgroundColor: teamColor }} />
                <div className="item-content">
                  <div className="item-left">
                    <div className="item-info">
                      <h3 className="item-title">
                        <span className={`position-badge ${index === 0 ? 'position-1' : index === 1 ? 'position-2' : index === 2 ? 'position-3' : 'position-other'}`}>
                          P{standing.position}
                        </span>
                        <span
                          className="clickable-text driver-name"
                          onClick={() => navigate(`/drivers/${standing.Driver.driverId}`)}
                        >
                          {standing.Driver.givenName} {standing.Driver.familyName}
                        </span>
                        <Tag color="blue" style={{ marginLeft: 8 }}>{standing.Driver.code}</Tag>
                      </h3>
                      <div className="item-stats">
                        <div className="item-stats-row">
                          <span className="stat-item team-name">
                            <span
                              className="clickable-text"
                              style={{ color: teamColor }}
                              onClick={() => navigate(`/constructors/${standing.Constructors[0].constructorId}`)}
                            >
                              {standing.Constructors[0].name}
                            </span>
                          </span>
                          {parseInt(standing.wins) > 0 && (
                            <span className="stat-item wins-badge">
                              <TrophyOutlined /> {standing.wins} 胜
                            </span>
                          )}
                        </div>
                        <div className="progress-wrapper">
                          <Progress
                            percent={percentage}
                            showInfo={false}
                            strokeColor={teamColor}
                            strokeWidth={6}
                            trailColor="var(--bg-tertiary)"
                            className="animated-progress"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="item-right">
                    <div className="stat-badge" style={{ background: teamColor }}>
                      <span className="stat-value" style={{ color: '#ffffff' }}>{standing.points}</span>
                      <span className="stat-label" style={{ color: '#ffffff' }}>积分</span>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )
    },
    {
      key: 'constructors',
      label: '车队积分榜',
      children: (
        <div className="list-container">
          {constructorStandings.map((standing, index) => {
            const teamColor = getTeamColor(standing.Constructor.constructorId);
            const points = parseFloat(standing.points);
            const percentage = maxConstructorPoints > 0 ? Math.min(100, (points / maxConstructorPoints) * 100) : 0;
            return (
              <Card
                key={standing.Constructor.constructorId}
                className="list-item"
                hoverable
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="team-color-bar" style={{ backgroundColor: teamColor }} />
                <div className="item-content">
                  <div className="item-left">
                    <div className="item-info">
                      <h3 className="item-title">
                        <span style={{
                          fontSize: 24,
                          fontWeight: 'bold',
                          color: index === 0 ? '#faad14' : index === 1 ? '#8c8c8c' : '#d48806',
                          marginRight: 12,
                          minWidth: 30,
                          display: 'inline-block'
                        }}>
                          P{standing.position}
                        </span>
                        <span
                          className="clickable-text"
                          style={{ fontWeight: 500, color: '#1890ff', cursor: 'pointer' }}
                          onClick={() => navigate(`/constructors/${standing.Constructor.constructorId}`)}
                        >
                          {standing.Constructor.name}
                        </span>
                      </h3>
                      <div className="item-stats">
                        <span className="stat-item">
                          🌍 {standing.Constructor.nationality}
                        </span>
                        <span className="stat-item">
                          <TrophyOutlined /> {standing.wins} 胜
                        </span>
                        <div style={{ marginTop: 8, width: '100%', maxWidth: 400 }} className="progress-wrapper">
                          <Progress
                            percent={percentage}
                            showInfo={false}
                            strokeColor={teamColor}
                            strokeWidth={8}
                            trailColor="#f0f0f0"
                            className="animated-progress"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="item-right">
                    <div className="stat-badge" style={{ background: teamColor }}>
                      <span className="stat-value" style={{ color: '#ffffff' }}>{standing.points}</span>
                      <span className="stat-label" style={{ color: '#ffffff' }}>积分</span>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )
    }
  ];

  return (
    <div className="list-page-container">
      <h1 className="page-title">🏆 <span>{currentSeason}赛季积分榜</span></h1>

      {loading ? (
        <div className="loading-container">
          <Spin size="large" />
        </div>
      ) : (
        <Card style={{ marginBottom: 24 }}>
          <Tabs defaultActiveKey="drivers" items={tabItems} />
        </Card>
      )}
    </div>
  );
};

export default Seasons;
