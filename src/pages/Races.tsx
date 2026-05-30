import { useNavigate } from 'react-router-dom';
import { Card, Spin } from 'antd';
import { CalendarOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { Helmet } from 'react-helmet-async';
import { useRaceStatus, useSeasonData } from '@/hooks';
import { useAppStore } from '@/store';
import type { Race } from '@/types';
import { formatRaceDateTime } from '@/utils/raceSchedule';
import './Races.css';

const RaceCard = ({ race, index }: { race: Race; index: number }) => {
  const navigate = useNavigate();
  const { status, color } = useRaceStatus(race);
  const isMobile = window.innerWidth <= 768;

  return (
    <Card
      key={race.round}
      className="list-item"
      hoverable
      style={{ animationDelay: `${index * 0.05}s` }}
      onClick={() => navigate(`/races/${race.round}`)}
    >
      <div className="team-color-bar" style={{ backgroundColor: color }} />
      <div className="item-content">
        <div className="item-left">
          <div className="item-info">
            <h3 className="item-title">
              Round {race.round}: {race.raceName}
            </h3>
            <div className="item-meta">
              {!isMobile && <span><EnvironmentOutlined /> {race.Circuit.circuitName}</span>}
              <span className="date-item"><CalendarOutlined /> {formatRaceDateTime(race)}</span>
            </div>
          </div>
        </div>
        <div className="item-right">
          <span className={`status-dot status-${status}`} />
        </div>
      </div>
    </Card>
  );
};

const Races = () => {
  const { currentSeason } = useAppStore();
  const { races, loading } = useSeasonData(currentSeason);

  return (
    <div className="list-page-container">
      <Helmet>
        <title>&#x6bd4;&#x8d5b;&#x5217;&#x8868; &#8212; F1 Dashboard</title>
        <meta name="description" content="F1&#x6bd4;&#x8d5b;&#x65e5;&#x7a0b;&#x5217;&#x8868;, &#x67e5;&#x770b;&#x5404;&#x7ad9;&#x6bd4;&#x8d5b;&#x4fe1;&#x606f;" />
      </Helmet>
      <h1 className="page-title"><span>{currentSeason} 赛季赛历</span></h1>

      {loading ? (
        <div className="loading-container">
          <Spin size="large" />
        </div>
      ) : (
        <div className="list-container">
          {races.map((race, index) => (
            <RaceCard key={race.round} race={race} index={index} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Races;
