import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Spin } from 'antd';
import { CarOutlined } from '@ant-design/icons';
import { useDriverStandingsCached } from '@/hooks';
import { useAppStore } from '@/store';
import { supabaseApi } from '@/api/supabase';
import { getTeamColor } from '@/utils/teamColors';
import './Drivers.css';

const TEXT = {
  title: '\u8f66\u624b',
  loadError: '\u52a0\u8f7d\u8f66\u624b\u5217\u8868\u5931\u8d25:',
  wins: '\u80dc',
};

const Drivers = () => {
  const navigate = useNavigate();
  const { currentSeason } = useAppStore();
  const { driverStandings, loading: standingsLoading } = useDriverStandingsCached(currentSeason);
  const [drivers, setDrivers] = useState<any[]>([]);

  useEffect(() => {
    const formattedDrivers = driverStandings.map((standing, index) => ({
      ...standing.Driver,
      total_wins: null,
      total_pole_positions: null,
      total_fastest_laps: null,
      total_race_starts: null,
      constructorId: standing.Constructors[0].constructorId,
      constructorName: standing.Constructors[0].name,
      index,
    }));

    setDrivers(formattedDrivers);
  }, [driverStandings]);

  useEffect(() => {
    if (driverStandings.length === 0) {
      return;
    }

    let cancelled = false;

    const enrichDrivers = async () => {
      try {
        const supabaseDrivers = await supabaseApi.drivers.getAll();
        const driverMap = new Map(supabaseDrivers.map((driver) => [driver.driver_id, driver]));
        const enrichedDrivers = driverStandings.map((standing, index) => {
          const dbDriver = driverMap.get(standing.Driver.driverId);
          return {
            ...standing.Driver,
            total_wins: dbDriver?.total_wins || null,
            total_pole_positions: dbDriver?.total_pole_positions || null,
            total_fastest_laps: dbDriver?.total_fastest_laps || null,
            total_race_starts: dbDriver?.total_race_starts || null,
            constructorId: standing.Constructors[0].constructorId,
            constructorName: standing.Constructors[0].name,
            index,
          };
        });

        if (!cancelled) {
          setDrivers(enrichedDrivers);
        }
      } catch (error) {
        console.error(TEXT.loadError, error);
      }
    };

    void enrichDrivers();

    return () => {
      cancelled = true;
    };
  }, [driverStandings]);

  const loading = standingsLoading && drivers.length === 0;

  return (
    <div className="list-page-container">
      <h1 className="page-title"><span>{TEXT.title}</span></h1>

      {loading ? (
        <div className="loading-container">
          <Spin size="large" />
        </div>
      ) : (
        <div className="list-container">
          {drivers.map((driver) => {
            const teamColor = getTeamColor(driver.constructorId);
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
                        {driver.code ? <span className="item-tag">#{driver.permanentNumber} {driver.code}</span> : null}
                      </h3>
                      <div className="item-stats">
                        <span className="stat-item">{driver.constructorName}</span>
                        {driver.total_wins ? (
                          <span className="stat-item"><CarOutlined /> {driver.total_wins} {TEXT.wins}</span>
                        ) : null}
                      </div>
                    </div>
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
