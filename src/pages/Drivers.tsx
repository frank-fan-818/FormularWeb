import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Spin } from 'antd';
import { CarOutlined } from '@ant-design/icons';
import { useSeasonData } from '@/hooks';
import { useAppStore } from '@/store';
import { supabaseApi } from '@/api/supabase';
import { getTeamColor } from '@/utils/teamColors';
import './Drivers.css';

const TEXT = {
  title: '\u8f66\u624b',
  loadError: '\u52a0\u8f7d\u8f66\u624b\u5217\u8868\u5931\u8d25:',
  wins: '\u80dc',
  podiums: '\u9886\u5956\u53f0',
};

const Drivers = () => {
  const navigate = useNavigate();
  const { currentSeason } = useAppStore();
  const { driverStandings, loading: seasonLoading } = useSeasonData(currentSeason);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [pageLoading, setPageLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      if (seasonLoading) {
        return;
      }

      if (driverStandings.length === 0) {
        setDrivers([]);
        return;
      }

      setPageLoading(true);

      try {
        const supabaseDrivers = await supabaseApi.drivers.getAll();
        const driverMap = new Map(supabaseDrivers.map((driver) => [driver.driver_id, driver]));

        const formattedDrivers = driverStandings.map((standing, index) => {
          const dbDriver = driverMap.get(standing.Driver.driverId);
          return {
            ...standing.Driver,
            total_wins: dbDriver?.total_wins || null,
            total_podiums: dbDriver?.total_podiums || null,
            total_pole_positions: dbDriver?.total_pole_positions || null,
            total_fastest_laps: dbDriver?.total_fastest_laps || null,
            total_race_starts: dbDriver?.total_race_starts || null,
            constructorId: standing.Constructors[0].constructorId,
            constructorName: standing.Constructors[0].name,
            index,
          };
        });

        if (!cancelled) {
          setDrivers(formattedDrivers);
        }
      } catch (error) {
        console.error(TEXT.loadError, error);
        if (!cancelled) {
          setDrivers([]);
        }
      } finally {
        if (!cancelled) {
          setPageLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [driverStandings, seasonLoading]);

  const loading = seasonLoading || pageLoading;

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
                  <div className="item-right">
                    {driver.total_podiums ? (
                      <div className="stat-badge" style={{ background: teamColor }}>
                        <span className="stat-value">{driver.total_podiums}</span>
                        <span className="stat-label">{TEXT.podiums}</span>
                      </div>
                    ) : null}
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
