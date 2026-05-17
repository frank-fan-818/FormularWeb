import { type ReactNode, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Spin } from 'antd';
import { FlagOutlined, TeamOutlined, TrophyOutlined } from '@ant-design/icons';
import { useConstructorStandingsCached, useSupabaseMetadata } from '@/hooks';
import { useAppStore } from '@/store';
import { supabaseApi } from '@/api/supabase';
import { getTeamColor } from '@/utils/teamColors';
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
      <h1 className="page-title"><span>{currentSeason} {TEXT.title}</span></h1>

      {loading ? (
        <div className="loading-container">
          <Spin size="large" />
        </div>
      ) : (
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
                onClick={() => navigate(`/constructors/${constructor.constructorId}`)}
              >
                <div className="constructor-card-topline">
                  <span className="constructor-team-swatch" style={{ backgroundColor: teamColor }} />
                  <span className="constructor-season-chip">
                    {TEXT.season} P{constructor.position || '-'} / {constructor.points || '0'} {TEXT.points}
                  </span>
                </div>
                <h2 className="constructor-card-name">{constructor.name}</h2>
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
      )}
    </div>
  );
};

export default Constructors;
