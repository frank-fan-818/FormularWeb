import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from 'antd';
import { CarOutlined, FlagOutlined, TrophyOutlined } from '@ant-design/icons';
import DocumentHead from '@/components/DocumentHead';
import { useDriverStandingsCached, useSupabaseMetadata } from '@/hooks';
import { useAppStore } from '@/store';
import { supabaseApi } from '@/api/supabase';
import { preloadDriverDetailRoute } from '@/utils/routePreload';
import { getTeamColor } from '@/utils/teamColors';
import { DriverAvatar } from '@/utils/driverImages';
import { ConstructorLogo } from '@/utils/constructorLogos';
import ProductMasthead from '@/components/product/ProductMasthead';
import ProductSectionHeader from '@/components/product/ProductSectionHeader';
import type { Driver } from '@/types';
import { TimingBeacon } from '@/components/loading/TimingBeacon';
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
  drivers: DriverLineupItem[];
}

interface DriverLineupItem extends Driver {
  total_wins: number | null;
  total_pole_positions: number | null;
  total_fastest_laps: number | null;
  total_race_starts: number | null;
  constructorId: string;
  constructorName: string;
  position: string;
  points: string;
  seasonWins: string;
  index: number;
}

const Drivers = () => {
  const navigate = useNavigate();
  const { currentSeason } = useAppStore();
  const { driverStandings, loading: standingsLoading } = useDriverStandingsCached(currentSeason);
  const fetchDriverMetadata = useCallback(
    () => supabaseApi.drivers.getListMetadata(),
    [],
  );
  const { data: driverMetadata } = useSupabaseMetadata(
    'supabase-driver-list-metadata',
    fetchDriverMetadata,
    driverStandings.length > 0,
  );

  const drivers = useMemo(() => {
    const driverMap = new Map((driverMetadata || []).map((driver) => [driver.driver_id, driver]));

    return driverStandings.map((standing, index) => {
      const dbDriver = driverMap.get(standing.Driver.driverId);
      const constructor = standing.Constructors[0];
      return {
        ...standing.Driver,
        total_wins: dbDriver?.total_wins || null,
        total_pole_positions: dbDriver?.total_pole_positions || null,
        total_fastest_laps: dbDriver?.total_fastest_laps || null,
        total_race_starts: dbDriver?.total_race_starts || null,
        constructorId: constructor?.constructorId || 'unknown',
        constructorName: constructor?.name || '-',
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
      <DocumentHead title="车手列表 — F1 Dashboard" description="F1车手列表，查看本赛季车手阵容和数据统计" />
      <ProductMasthead
        index="03"
        eyebrow={`${currentSeason} / GRID ROSTER`}
        title={<>THE<br />DRIVER GRID</>}
        metrics={[
          { label: '\u73b0\u5f79\u8f66\u624b', value: drivers.length || '--', detail: `${driverGroups.length} \u652f\u8f66\u961f` },
          { label: '\u79ef\u5206\u9886\u8dd1', value: drivers[0] ? `${drivers[0].givenName[0]}. ${drivers[0].familyName}` : '--', detail: drivers[0] ? `${drivers[0].points} PTS` : '\u6b63\u5728\u8bfb\u53d6', accent: drivers[0] ? getTeamColor(drivers[0].constructorId) : undefined },
          { label: '\u672c\u5b63\u6700\u591a\u80dc\u573a', value: drivers[0]?.seasonWins || '--', detail: drivers[0]?.familyName || '\u5f85\u5b9a' },
        ]}
      />
      {loading ? (
        <div className="loading-container">
          <TimingBeacon label="Building the driver grid" detail={`${currentSeason} standings · teams · profiles`} />
        </div>
      ) : drivers.length === 0 ? (
        <div className="driver-lineup-empty">当前赛季暂无车手阵容数据。</div>
      ) : (
        <>
        <ProductSectionHeader index="01" eyebrow="PADDOCK INDEX" title="车手阵容" />
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
                      onPointerEnter={() => preloadDriverDetailRoute(driver.driverId, currentSeason)}
                      onPointerDown={() => preloadDriverDetailRoute(driver.driverId, currentSeason)}
                      onFocus={() => preloadDriverDetailRoute(driver.driverId, currentSeason)}
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
                        <DriverAvatar
                          driverId={driver.driverId}
                          size={48}
                          givenName={driver.givenName}
                          familyName={driver.familyName}
                        />
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
        </>
      )}
    </div>
  );
};

export default Drivers;
