import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Spin, Tabs } from 'antd';
import { useSeasonData } from '@/hooks';
import { useAppStore } from '@/store';
import { getTeamColor, getTeamDarkColor } from '@/utils/teamColors';
import './Seasons.css';

const TEXT = {
  drivers: '车手',
  constructors: '车队',
  points: '积分',
  nationality: '国籍',
  seasonStandings: '赛季积分榜',
};

interface ProgressBarProps {
  color: string;
  percentage: number;
}

const SeasonProgressBar = ({ color, percentage }: ProgressBarProps) => (
  <div className="season-progress" aria-hidden="true">
    <div
      className="season-progress-bar"
      style={{
        width: `${percentage}%`,
        backgroundColor: color,
      }}
    />
  </div>
);

const Seasons = () => {
  const navigate = useNavigate();
  const { currentSeason } = useAppStore();
  const { driverStandings, constructorStandings, loading } = useSeasonData(currentSeason);
  const maxDriverPoints = driverStandings[0] ? parseFloat(driverStandings[0].points) : 0;
  const maxConstructorPoints = constructorStandings[0] ? parseFloat(constructorStandings[0].points) : 0;

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const tabItems = [
    {
      key: 'drivers',
      label: TEXT.drivers,
      children: (
        <div className="list-container">
          {driverStandings.map((standing, index) => {
            const teamColor = getTeamColor(standing.Constructors[0].constructorId);
            const darkTeamColor = getTeamDarkColor(standing.Constructors[0].constructorId);
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
                        <span
                          className={`position-badge ${index === 0 ? 'position-1' : index === 1 ? 'position-2' : index === 2 ? 'position-3' : 'position-other'}`}
                        >
                          P{standing.position}
                        </span>
                        <span
                          className="clickable-text driver-name"
                          onClick={() => navigate(`/drivers/${standing.Driver.driverId}`)}
                        >
                          {standing.Driver.givenName} {standing.Driver.familyName}
                        </span>
                      </h3>
                      <div className="item-stats">
                        <span
                          className="stat-item team-name clickable-text"
                          style={{ color: teamColor }}
                          onClick={() => navigate(`/constructors/${standing.Constructors[0].constructorId}`)}
                        >
                          {standing.Constructors[0].name}
                        </span>
                        {isMobile ? (
                          <span className="mobile-points-inline" style={{ color: darkTeamColor }}>
                            {standing.points} pts
                          </span>
                        ) : null}
                        <div className="progress-wrapper">
                          <SeasonProgressBar color={teamColor} percentage={percentage} />
                        </div>
                      </div>
                    </div>
                  </div>
                  {!isMobile ? (
                    <div className="item-right">
                      <div
                        className="points-badge"
                        style={{
                          background: darkTeamColor,
                          boxShadow: `0 4px 15px ${darkTeamColor}40`,
                        }}
                      >
                        <span className="points-value">{standing.points}</span>
                        <span className="points-label">{TEXT.points}</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      ),
    },
    {
      key: 'constructors',
      label: TEXT.constructors,
      children: (
        <div className="list-container">
          {constructorStandings.map((standing, index) => {
            const teamColor = getTeamColor(standing.Constructor.constructorId);
            const darkTeamColor = getTeamDarkColor(standing.Constructor.constructorId);
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
                        <span
                          className={`position-badge ${index === 0 ? 'position-1' : index === 1 ? 'position-2' : index === 2 ? 'position-3' : 'position-other'}`}
                        >
                          P{standing.position}
                        </span>
                        <span
                          className="clickable-text constructor-name"
                          onClick={() => navigate(`/constructors/${standing.Constructor.constructorId}`)}
                        >
                          {standing.Constructor.name}
                        </span>
                        <span className="item-tag">{TEXT.nationality} {standing.Constructor.nationality}</span>
                      </h3>
                      <div className="item-stats">
                        {isMobile ? (
                          <span className="mobile-points-inline" style={{ color: darkTeamColor }}>
                            {standing.points} pts
                          </span>
                        ) : null}
                        <div className="progress-wrapper">
                          <SeasonProgressBar color={teamColor} percentage={percentage} />
                        </div>
                      </div>
                    </div>
                  </div>
                  {!isMobile ? (
                    <div className="item-right">
                      <div
                        className="points-badge"
                        style={{
                          background: darkTeamColor,
                          boxShadow: `0 4px 15px ${darkTeamColor}40`,
                        }}
                      >
                        <span className="points-value">{standing.points}</span>
                        <span className="points-label">{TEXT.points}</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      ),
    },
  ];

  return (
    <div className="list-page-container">
      <h1 className="page-title"><span>{currentSeason} {TEXT.seasonStandings}</span></h1>

      {loading ? (
        <div className="loading-container">
          <Spin size="large" />
        </div>
      ) : (
        <Tabs defaultActiveKey="drivers" items={tabItems} />
      )}
    </div>
  );
};

export default Seasons;
