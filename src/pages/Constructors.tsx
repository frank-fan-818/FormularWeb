import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Spin } from 'antd';
import { GlobalOutlined, FlagOutlined, TrophyOutlined } from '@ant-design/icons';
import { useConstructorStandingsCached } from '@/hooks';
import { useAppStore } from '@/store';
import { supabaseApi } from '@/api/supabase';
import { getTeamColor } from '@/utils/teamColors';
import './Constructors.css';

const TEXT = {
  title: '\u8f66\u961f',
  loadError: '\u52a0\u8f7d\u8f66\u961f\u5217\u8868\u5931\u8d25:',
  wins: '\u80dc',
  poles: '\u6746\u4f4d',
  entries: '\u53c2\u8d5b\u573a\u6b21',
  nationality: '\u56fd\u7c4d',
};

const Constructors = () => {
  const navigate = useNavigate();
  const { currentSeason } = useAppStore();
  const { constructorStandings, loading: standingsLoading } = useConstructorStandingsCached(currentSeason);
  const [constructors, setConstructors] = useState<any[]>([]);

  useEffect(() => {
    const formattedConstructors = constructorStandings.map((standing, index) => ({
      ...standing.Constructor,
      nationality: standing.Constructor.nationality || '',
      total_wins: null,
      total_pole_positions: null,
      total_fastest_laps: null,
      total_race_entries: null,
      index,
    }));

    setConstructors(formattedConstructors);
  }, [constructorStandings]);

  useEffect(() => {
    if (constructorStandings.length === 0) {
      return;
    }

    let cancelled = false;

    const enrichConstructors = async () => {
      try {
        const supabaseConstructors = await supabaseApi.constructors.getAll();
        const constructorMap = new Map(supabaseConstructors.map((constructor) => [constructor.constructor_id, constructor]));
        const enrichedConstructors = constructorStandings.map((standing, index) => {
          const dbConstructor = constructorMap.get(standing.Constructor.constructorId);
          return {
            ...standing.Constructor,
            nationality: dbConstructor?.nationality || standing.Constructor.nationality || '',
            total_wins: dbConstructor?.total_wins || null,
            total_pole_positions: dbConstructor?.total_pole_positions || null,
            total_fastest_laps: dbConstructor?.total_fastest_laps || null,
            total_race_entries: dbConstructor?.total_race_entries || null,
            index,
          };
        });

        if (!cancelled) {
          setConstructors(enrichedConstructors);
        }
      } catch (error) {
        console.error(TEXT.loadError, error);
      }
    };

    void enrichConstructors();

    return () => {
      cancelled = true;
    };
  }, [constructorStandings]);

  const loading = standingsLoading && constructors.length === 0;

  return (
    <div className="list-page-container">
      <h1 className="page-title"><span>{TEXT.title}</span></h1>

      {loading ? (
        <div className="loading-container">
          <Spin size="large" />
        </div>
      ) : (
        <div className="list-container">
          {constructors.map((constructor) => {
            const teamColor = getTeamColor(constructor.constructorId);
            return (
              <Card
                key={constructor.constructorId}
                className="list-item"
                hoverable
                style={{ animationDelay: `${constructor.index * 0.05}s` }}
                onClick={() => navigate(`/constructors/${constructor.constructorId}`)}
              >
                <div className="team-color-bar" style={{ backgroundColor: teamColor }} />
                <div className="item-content">
                  <div className="item-left">
                    <div className="item-info">
                      <h3 className="item-title">
                        {constructor.name}
                      </h3>
                      <div className="item-stats">
                        {constructor.nationality ? (
                          <span className="stat-item"><GlobalOutlined /> {TEXT.nationality}: {constructor.nationality}</span>
                        ) : null}
                        {constructor.total_wins ? (
                          <span className="stat-item"><TrophyOutlined /> {constructor.total_wins} {TEXT.wins}</span>
                        ) : null}
                        {constructor.total_pole_positions ? (
                          <span className="stat-item"><FlagOutlined /> {constructor.total_pole_positions} {TEXT.poles}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="item-right">
                    {constructor.total_race_entries ? (
                      <div className="stat-badge" style={{ background: teamColor }}>
                        <span className="stat-value" style={{ color: '#ffffff' }}>{constructor.total_race_entries}</span>
                        <span className="stat-label" style={{ color: '#ffffff' }}>{TEXT.entries}</span>
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

export default Constructors;
