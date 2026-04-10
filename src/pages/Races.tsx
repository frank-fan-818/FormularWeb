import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Tag, Spin } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, CalendarOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { useAppStore } from '@/store';
import { seasonApi } from '@/api/ergast';
import { useRaceStatus } from '@/hooks';
import type { Race } from '@/types';
import dayjs from 'dayjs';
import './Races.css';

const RaceCard = ({ race, index }: { race: Race; index: number }) => {
  const navigate = useNavigate();
  const { status, text, color, antdColor } = useRaceStatus(race);

  const icons = {
    ongoing: <ClockCircleOutlined />,
    completed: <CheckCircleOutlined />,
    upcoming: <ClockCircleOutlined />,
  };

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
              <span><EnvironmentOutlined /> {race.Circuit.circuitName}</span>
              <span className="date-item"><CalendarOutlined /> {dayjs(race.date).format('YYYY年M月D日')}</span>
            </div>
          </div>
        </div>
        <div className="item-right">
          <Tag color={antdColor} icon={icons[status]}>{text}</Tag>
        </div>
      </div>
    </Card>
  );
};

const Races = () => {
  const { currentSeason } = useAppStore();
  const [races, setRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const data = await seasonApi.getSeasonRaces(currentSeason);
      setRaces(data);
      setLoading(false);
    };
    loadData();
  }, [currentSeason]);

  return (
    <div className="list-page-container">
      <h1 className="page-title">📅 <span>{currentSeason}赛季赛历</span></h1>

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
