import { useNavigate } from 'react-router-dom';
import { Card, Spin, Tabs } from 'antd';
import { useSeasonData } from '@/hooks';
import { useAppStore } from '@/store';
import { getTeamColor, getTeamDarkColor } from '@/utils/teamColors';
import './Seasons.css';

const TEXT = {
  drivers: '\u8f66\u624b',
  constructors: '\u8f66\u961f',
  points: '\u79ef\u5206',
  nationality: '\u56fd\u7c4d',
  seasonStandings: '\u8d5b\u5b63\u79ef\u5206\u699c',
  position: 'POS',
  driver: '\u8f66\u624b',
  team: '\u8f66\u961f',
  gap: '\u5dee\u8ddd',
  leader: '\u9886\u5148',
};

function formatGap(points: string, leaderPoints: number): string {
  const value = parseFloat(points);
  if (!Number.isFinite(value) || leaderPoints <= 0 || value === leaderPoints) {
    return TEXT.leader;
  }

  return `-${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(leaderPoints - value)}`;
}

const Seasons = () => {
  const navigate = useNavigate();
  const { currentSeason } = useAppStore();
  const { driverStandings, constructorStandings, loading } = useSeasonData(currentSeason);
  const maxDriverPoints = driverStandings[0] ? parseFloat(driverStandings[0].points) : 0;
  const maxConstructorPoints = constructorStandings[0] ? parseFloat(constructorStandings[0].points) : 0;

  const tabItems = [
    {
      key: 'drivers',
      label: TEXT.drivers,
      children: (
        <div className="official-season-table">
          <div className="official-season-head">
            <span>{TEXT.position}</span>
            <span>{TEXT.driver}</span>
            <span>{TEXT.team}</span>
            <span>{TEXT.points}</span>
          </div>
          {driverStandings.map((standing, index) => {
            const constructor = standing.Constructors[0];
            const teamColor = getTeamColor(constructor.constructorId);
            const darkTeamColor = getTeamDarkColor(constructor.constructorId);

            return (
              <Card
                key={standing.Driver.driverId}
                className="official-season-row"
                hoverable
                style={{ animationDelay: `${index * 0.035}s`, borderLeftColor: teamColor }}
              >
                <div className="official-rank">P{standing.position}</div>
                <div className="official-identity">
                  <button
                    type="button"
                    className="official-name-button"
                    onClick={() => navigate(`/drivers/${standing.Driver.driverId}`)}
                  >
                    {standing.Driver.givenName} {standing.Driver.familyName}
                  </button>
                  <div className="official-subline">
                    <span className="official-code">{standing.Driver.code || standing.Driver.nationality}</span>
                    <span>{TEXT.gap}: {formatGap(standing.points, maxDriverPoints)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="official-team-link"
                  onClick={() => navigate(`/constructors/${constructor.constructorId}`)}
                >
                  <span className="official-team-swatch" style={{ backgroundColor: teamColor }} />
                  <span>{constructor.name}</span>
                </button>
                <div className="official-points-cell">
                  <div className="official-points-value" style={{ color: darkTeamColor }}>
                    {standing.points}
                  </div>
                  <div className="official-points-label">{TEXT.points}</div>
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
        <div className="official-season-table">
          <div className="official-season-head">
            <span>{TEXT.position}</span>
            <span>{TEXT.team}</span>
            <span>{TEXT.nationality}</span>
            <span>{TEXT.points}</span>
          </div>
          {constructorStandings.map((standing, index) => {
            const teamColor = getTeamColor(standing.Constructor.constructorId);
            const darkTeamColor = getTeamDarkColor(standing.Constructor.constructorId);

            return (
              <Card
                key={standing.Constructor.constructorId}
                className="official-season-row"
                hoverable
                style={{ animationDelay: `${index * 0.035}s`, borderLeftColor: teamColor }}
                onClick={() => navigate(`/constructors/${standing.Constructor.constructorId}`)}
              >
                <div className="official-rank">P{standing.position}</div>
                <div className="official-identity">
                  <div className="official-team-title">
                    <span className="official-team-swatch" style={{ backgroundColor: teamColor }} />
                    <span>{standing.Constructor.name}</span>
                  </div>
                  <div className="official-subline">{TEXT.gap}: {formatGap(standing.points, maxConstructorPoints)}</div>
                </div>
                <div className="official-nationality">{standing.Constructor.nationality}</div>
                <div className="official-points-cell">
                  <div className="official-points-value" style={{ color: darkTeamColor }}>
                    {standing.points}
                  </div>
                  <div className="official-points-label">{TEXT.points}</div>
                </div>
              </Card>
            );
          })}
        </div>
      ),
    },
  ];

  return (
    <div className="list-page-container season-standings-page">
      <h1 className="page-title"><span>{currentSeason} {TEXT.seasonStandings}</span></h1>

      {loading ? (
        <div className="loading-container">
          <Spin size="large" />
        </div>
      ) : (
        <Tabs defaultActiveKey="drivers" items={tabItems} className="official-season-tabs" />
      )}
    </div>
  );
};

export default Seasons;
