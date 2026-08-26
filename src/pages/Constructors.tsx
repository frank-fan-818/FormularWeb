import { type ReactNode, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from 'antd';
import { FlagOutlined, TeamOutlined, TrophyOutlined } from '@ant-design/icons';
import DocumentHead from '@/components/DocumentHead';
import { useConstructorStandingsCached, useSupabaseMetadata } from '@/hooks';
import { useAppStore } from '@/store';
import { supabaseApi } from '@/api/supabase';
import { preloadConstructorDetailRoute } from '@/utils/routePreload';
import { getTeamColor } from '@/utils/teamColors';
import { ConstructorLogo } from '@/utils/constructorLogos';
import ProductMasthead from '@/components/product/ProductMasthead';
import ProductSectionHeader from '@/components/product/ProductSectionHeader';
import { TimingBeacon } from '@/components/loading/TimingBeacon';
import './Constructors.css';

const TEXT = {
  title: '\u8f66\u961f',
  wins: '\u80dc',
  poles: '\u6746\u4f4d',
  entries: '\u53c2\u8d5b\u573a\u6b21',
  points: '\u79ef\u5206',
  nationality: '\u56fd\u7c4d',
  season: '\u672c\u5b63',
  fastestLaps: '\u6700\u5feb\u5708',
};

interface ConstructorProfileStat {
  key: string;
  icon: ReactNode;
  value: ReactNode;
  label: string;
}

function hasStatValue(value: unknown): boolean {
  if (value === null || value === undefined || value === '') {
    return false;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0;
}

const Constructors = () => {
  const navigate = useNavigate();
  const { currentSeason } = useAppStore();
  const { constructorStandings, loading: standingsLoading } = useConstructorStandingsCached(currentSeason);
  const fetchConstructorMetadata = useCallback(() => supabaseApi.constructors.getListMetadata(), []);
  const { data: constructorMetadata } = useSupabaseMetadata(
    'supabase-constructor-list-metadata',
    fetchConstructorMetadata,
    constructorStandings.length > 0,
  );

  const constructors = useMemo(() => {
    const constructorMap = new Map((constructorMetadata || []).map((constructor) => [constructor.constructor_id, constructor]));

    return constructorStandings.map((standing, index) => {
      const dbConstructor = constructorMap.get(standing.Constructor.constructorId);
      return {
        ...standing.Constructor,
        nationality: dbConstructor?.nationality || standing.Constructor.nationality || '',
        total_wins: dbConstructor?.total_wins || null,
        total_pole_positions: dbConstructor?.total_pole_positions || null,
        total_fastest_laps: dbConstructor?.total_fastest_laps || null,
        total_race_entries: dbConstructor?.total_race_entries || null,
        position: standing.position,
        points: standing.points,
        seasonWins: standing.wins,
        index,
      };
    });
  }, [constructorMetadata, constructorStandings]);

  const loading = standingsLoading && constructors.length === 0;

  return (
    <div className="list-page-container constructors-page">
      <DocumentHead title="车队列表 — F1 Dashboard" description="F1车队列表，查看本赛季车队阵容和数据统计" />
      <ProductMasthead
        index="04"
        eyebrow={`${currentSeason} / TEAM LIBRARY`}
        title={<>THE<br />CONSTRUCTORS</>}
        metrics={[
          { label: '\u53c2\u8d5b\u8f66\u961f', value: constructors.length || '--', detail: `${currentSeason} GRID` },
          { label: '\u79ef\u5206\u9886\u8dd1', value: constructors[0]?.name || '--', detail: constructors[0] ? `${constructors[0].points} PTS` : '\u6b63\u5728\u8bfb\u53d6', accent: constructors[0] ? getTeamColor(constructors[0].constructorId) : undefined },
          { label: '\u9886\u8dd1\u80dc\u573a', value: constructors[0]?.seasonWins || '--', detail: constructors[0]?.name || '\u5f85\u5b9a' },
        ]}
      />
      {loading ? (
        <div className="loading-container">
          <TimingBeacon label="Loading constructor standings" detail={`${currentSeason} teams · points · performance`} />
        </div>
      ) : constructors.length === 0 ? (
        <div className="constructor-library-empty">当前赛季暂无车队数据。</div>
      ) : (
        <>
        <ProductSectionHeader index="01" eyebrow="TEAM INDEX" title="车队列表" />
        <div className="constructor-library-grid">
          {constructors.map((constructor) => {
            const teamColor = getTeamColor(constructor.constructorId);
            const profileStats: ConstructorProfileStat[] = [];

            if (hasStatValue(constructor.total_race_entries)) {
              profileStats.push({
                key: 'entries',
                icon: <TeamOutlined />,
                value: String(constructor.total_race_entries),
                label: TEXT.entries,
              });
            }

            if (hasStatValue(constructor.total_wins)) {
              profileStats.push({
                key: 'wins',
                icon: <TrophyOutlined />,
                value: String(constructor.total_wins),
                label: TEXT.wins,
              });
            }

            if (hasStatValue(constructor.total_pole_positions)) {
              profileStats.push({
                key: 'poles',
                icon: <FlagOutlined />,
                value: String(constructor.total_pole_positions),
                label: TEXT.poles,
              });
            }

            if (hasStatValue(constructor.total_fastest_laps)) {
              profileStats.push({
                key: 'fastest-laps',
                icon: <FlagOutlined />,
                value: String(constructor.total_fastest_laps),
                label: TEXT.fastestLaps,
              });
            }

            return (
              <Card
                key={constructor.constructorId}
                className="constructor-profile-card"
                hoverable
                style={{ animationDelay: `${constructor.index * 0.045}s`, borderTopColor: teamColor }}
                onPointerEnter={() => preloadConstructorDetailRoute(constructor.constructorId, currentSeason)}
                onPointerDown={() => preloadConstructorDetailRoute(constructor.constructorId, currentSeason)}
                onFocus={() => preloadConstructorDetailRoute(constructor.constructorId, currentSeason)}
                onClick={() => navigate(`/constructors/${constructor.constructorId}`)}
              >
                <div className="constructor-card-topline">
                  <span className="constructor-team-swatch" style={{ backgroundColor: teamColor }} />
                  <span className="constructor-season-chip">
                    {TEXT.season} P{constructor.position || '-'} / {constructor.points || '0'} {TEXT.points}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <ConstructorLogo constructorId={constructor.constructorId} size={48} />
                  <h2 className="constructor-card-name" style={{ margin: 0 }}>{constructor.name}</h2>
                </div>
                {constructor.nationality ? (
                  <div className="constructor-card-meta">
                    <span>{TEXT.nationality}</span>
                    <strong>{String(constructor.nationality)}</strong>
                  </div>
                ) : null}
                {profileStats.length > 0 ? (
                  <div className="constructor-profile-stats">
                    {profileStats.map((stat) => (
                      <span key={stat.key}>
                        {stat.icon}
                        <strong>{stat.value}</strong>
                        {stat.label}
                      </span>
                    ))}
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
        </>
      )}
    </div>
  );
};

export default Constructors;
