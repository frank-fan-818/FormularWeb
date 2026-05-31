import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Spin } from 'antd';
import { CarOutlined, FlagOutlined, TrophyOutlined } from '@ant-design/icons';
import { Helmet } from 'react-helmet-async';
import { useDriverStandingsCached, useSupabaseMetadata } from '@/hooks';
import { useAppStore } from '@/store';
import { supabaseApi } from '@/api/supabase';
import { getTeamColor } from '@/utils/teamColors';
import { DriverAvatar } from '@/utils/driverImages';
import { ConstructorLogo } from '@/utils/constructorLogos';
import './Drivers.css';

const TEXT = {
  title: '\u8f66\u624b',
  wins: '\u80dc',
  points: '\u79ef\u5206',
  starts: '\u53c2\u8d5b',
  poles: '\u6746\u4f4d',
  lineup: '\u9635\u5bb9',
  season: '\u672c\u5b63',
  fastestLaps: '\u6700\u5feb\u5708',
};

interface DriverLineupGroup {
  constructorId: string;
  constructorName: string;
  drivers: any[];
}

const Drivers = () => {
  const navigate = useNavigate();
  const { currentSeason } = useAppStore();
  const { driverStandings, loading: standingsLoading } = useDriverStandingsCached(currentSeason);
  const fetchDriverMetadata = useCallback(() => supabaseApi.drivers.getListMetadata(), []);
  const { data: driverMetadata } = useSupabaseMetadata(
    'supabase-driver-list-metadata',
    fetchDriverMetadata,
    driverStandings.length > 0,
  );

  const drivers = useMemo(() => {
    const driverMap = new Map((driverMetadata || []).map((driver) => [driver.driver_id, driver]));

    return driverStandings.map((standing, index) => {
      const dbDriver = driverMap.get(standing.Driver.driverId);
      return {
        ...standing.Driver,
        total_wins: dbDriver?.total_wins || null,
        total_pole_positions: dbDriver?.total_pole_positions || null,
        total_fastest_laps: dbDriver?.total_fastest_laps || null,
        total_race_starts: dbDriver?.total_race_starts || null,
        constructorId: standing.Constructors[0].constructorId,
        constructorName: standing.Constructors[0].name,
        position: standing.position,
        points: standing.points,
        seasonWins: standing.wins,
        index,
      };
    });
  }, [driverMetadata, driverStandings]);

  const driverGroups = useMemo(() => {
    const groups = new Map<string, DriverLineupGroup>();
    drivers.forEach((driver) => {
      const key = driver.constructorId || 'unknown';
      const group: DriverLineupGroup = groups.get(key) || {
        constructorId: key,
        constructorName: driver.constructorName || '-',
        drivers: [],
      };
      group.drivers.push(driver);
      groups.set(key, group);
    });

    return Array.from(groups.values());
  }, [drivers]);

  const loading = standingsLoading && drivers.length === 0;

  return (
    <div className="list-page-container drivers-lineup-page">
      <Helmet>
        <title>&#x8f66;&#x624b;&#x5217;&#x8868; &#8212; F1 Dashboard</title>
        <meta name="description" content="F1&#x8f66;&#x624b;&#x5217;&#x8868;&#xff0c;&#x67e5;&#x770b;&#x672c;&#x8d5b;&#x5b63;&#x8f66;&#x624b;&#x9635;&#x5bb9;&#x548c;&#x6570;&#x636e;&#x7edf;&#x8ba1;" />
      </Helmet>
      <h1 className="page-title"><span>{currentSeason} {TEXT.title}</span></h1>

      {loading ? (
        <div className="loading-container">
          <Spin size="large" />
        </div>
      ) : (
        <div className="driver-lineup-container">
          {driverGroups.map((group, groupIndex) => {
            const teamColor = getTeamColor(group.constructorId);

            return (
              <section
                key={group.constructorId}
                className="driver-team-group"
                style={{ animationDelay: `${groupIndex * 0.06}s`, borderTopColor: teamColor }}
              >
                <div className="driver-team-header">
                  <span className="driver-team-swatch" style={{ backgroundColor: teamColor }} />
                  <div>
                    <h2>{group.constructorName}</h2>
                    <p>{TEXT.lineup}</p>
                  </div>
                </div>

                <div className="driver-lineup-grid">
                  {group.drivers.map((driver) => (
                    <Card
                      key={driver.driverId}
                      className="driver-lineup-card"
                      hoverable
                      onClick={() => navigate(`/drivers/${driver.driverId}`)}
                    >
                      <div className="driver-card-topline">
                        <span className="driver-number-mark" style={{ color: teamColor }}>
                          {driver.permanentNumber ? `#${driver.permanentNumber}` : driver.code || '--'}
                        </span>
                        <span className="driver-rank-pill">
                          {TEXT.season} P{driver.position || '-'} / {driver.points || '0'} {TEXT.points}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <DriverAvatar driverId={driver.driverId} size={48} />
                        <div style={{ flex: 1 }}>
                          <h3 className="driver-card-name" style={{ margin: 0 }}>
                            <span>{driver.givenName}</span>
                            <strong>{driver.familyName}</strong>
                          </h3>
                          <div className="driver-card-meta" style={{ marginTop: 2 }}>
                            <span>{driver.code || '-'}</span>
                            <span>{driver.nationality || '-'}</span>
                            <ConstructorLogo constructorId={driver.constructorId} size={20} />
                          </div>
                        </div>
                      </div>
                      <div className="driver-card-stats">
                        {driver.total_race_starts ? <span><CarOutlined /> {driver.total_race_starts} {TEXT.starts}</span> : null}
                        {driver.total_wins ? <span><TrophyOutlined /> {driver.total_wins} {TEXT.wins}</span> : null}
                        {driver.total_pole_positions ? <span>{driver.total_pole_positions} {TEXT.poles}</span> : null}
                        {driver.total_fastest_laps ? <span><FlagOutlined /> {driver.total_fastest_laps} {TEXT.fastestLaps}</span> : null}
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Drivers;
