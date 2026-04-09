import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Spin } from 'antd';
import { CarOutlined, CalendarOutlined, GlobalOutlined } from '@ant-design/icons';
import { useAppStore } from '@/store';
import { supabaseApi } from '@/api/supabase';
import type { Driver } from '@/types';
import { getTeamColor } from '@/utils/teamColors';
import dayjs from 'dayjs';
import './Drivers.css';

const Drivers = () => {
  const navigate = useNavigate();
  const { currentSeason } = useAppStore();
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      try {
        const { seasonApi } = await import('@/api/ergast');
        const standings = await seasonApi.getDriverStandings(currentSeason);

        const supabaseDrivers = await supabaseApi.drivers.getAll();
        const driverMap = new Map(supabaseDrivers.map(d => [d.driver_id, d]));

        const formattedDrivers = standings.map((s, index) => {
          const dbDriver = driverMap.get(s.Driver.driverId);
          return {
            ...s.Driver,
            total_wins: dbDriver?.total_wins || null,
            total_podiums: dbDriver?.total_podiums || null,
            total_pole_positions: dbDriver?.total_pole_positions || null,
            total_fastest_laps: dbDriver?.total_fastest_laps || null,
            total_race_starts: dbDriver?.total_race_starts || null,
            constructorId: s.Constructors[0].constructorId,
            constructorName: s.Constructors[0].name,
            index,
          };
        });

        setDrivers(formattedDrivers);
      } catch (error) {
        console.error('加载车手失败:', error);
        setDrivers([]);
      }

      setLoading(false);
    };
    loadData();
  }, [currentSeason]);

  return (
    <div className="list-page-container">
      <h1 className="page-title">🏎️ <span>车手库</span></h1>

      {loading ? (
        <div className="loading-container">
          <Spin size="large" />
        </div>
      ) : (
        <div className="list-container">
          {drivers.map((driver) => {
            const teamColor = getTeamColor(driver.constructorId);
            console.log('Driver:', driver.driverId, 'Constructor:', driver.constructorId, 'Color:', teamColor);
            return (
              <Card
                key={driver.driverId}
                className="list-item"
                hoverable
                style={{ animationDelay: `${driver.index * 0.05}s` }}
                onClick={() => navigate(`/drivers/${driver.driverId}`)}
              >
                <div className="team-color-bar" style={{ backgroundColor: teamColor }} />
                <div className="item-content">
                  <div className="item-left">
                    <div className="item-info">
                      <h3 className="item-title">
                        {driver.givenName} {driver.familyName}
                        {driver.code && <span className="item-tag">#{driver.permanentNumber} {driver.code}</span>}
                      </h3>
                      <div className="item-stats">
                        <span className="stat-item"><GlobalOutlined /> {driver.nationality}</span>
                        <span className="stat-item"><CalendarOutlined /> {dayjs(driver.dateOfBirth).format('YYYY-MM-DD')}</span>
                        <span className="stat-item">🏎️ {driver.constructorName}</span>
                        {driver.total_wins && (
                          <span className="stat-item"><CarOutlined /> {driver.total_wins} 胜</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="item-right">
                    {driver.total_podiums && (
                      <div className="stat-badge" style={{ background: teamColor }}>
                        <span className="stat-value">{driver.total_podiums}</span>
                        <span className="stat-label">领奖台</span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Drivers;
