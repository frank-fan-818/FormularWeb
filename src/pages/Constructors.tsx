import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Spin } from 'antd';
import { GlobalOutlined, CarOutlined, FlagOutlined, TrophyOutlined } from '@ant-design/icons';
import { useSeasonData } from '@/hooks';
import { useAppStore } from '@/store';
import { supabaseApi } from '@/api/supabase';
import { getTeamColor } from '@/utils/teamColors';
import './Constructors.css';

const Constructors = () => {
  const navigate = useNavigate();
  const { currentSeason } = useAppStore();
  const { constructorStandings, loading: seasonLoading } = useSeasonData(currentSeason);
  const [constructors, setConstructors] = useState<any[]>([]);
  const [pageLoading, setPageLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      if (seasonLoading) {
        return;
      }

      if (constructorStandings.length === 0) {
        setConstructors([]);
        return;
      }

      setPageLoading(true);

      try {
        const supabaseConstructors = await supabaseApi.constructors.getAll();
        const constructorMap = new Map(supabaseConstructors.map((constructor) => [constructor.constructor_id, constructor]));

        const formattedConstructors = constructorStandings.map((standing, index) => {
          const dbConstructor = constructorMap.get(standing.Constructor.constructorId);
          return {
            ...standing.Constructor,
            total_wins: dbConstructor?.total_wins || null,
            total_podiums: dbConstructor?.total_podiums || null,
            total_pole_positions: dbConstructor?.total_pole_positions || null,
            total_fastest_laps: dbConstructor?.total_fastest_laps || null,
            total_race_entries: dbConstructor?.total_race_entries || null,
            index,
          };
        });

        if (!cancelled) {
          setConstructors(formattedConstructors);
        }
      } catch (error) {
        console.error('加载车队列表失败:', error);
        if (!cancelled) {
          setConstructors([]);
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
  }, [constructorStandings, seasonLoading]);

  const loading = seasonLoading || pageLoading;

  return (
    <div className="list-page-container">
      <h1 className="page-title"><span>车队</span></h1>

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
                        {constructor.total_wins && (
                          <span className="stat-item"><TrophyOutlined /> {constructor.total_wins} wins</span>
                        )}
                        {constructor.total_podiums && (
                          <span className="stat-item"><CarOutlined /> {constructor.total_podiums} podiums</span>
                        )}
                        {constructor.total_pole_positions && (
                          <span className="stat-item"><FlagOutlined /> {constructor.total_pole_positions} poles</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="item-right">
                    <span className="stat-item nationality-item"><GlobalOutlined /> {constructor.nationality}</span>
                    {constructor.total_race_entries && (
                      <div className="stat-badge" style={{ background: teamColor }}>
                        <span className="stat-value" style={{ color: '#ffffff' }}>{constructor.total_race_entries}</span>
                        <span className="stat-label" style={{ color: '#ffffff' }}>参赛场次</span>
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

export default Constructors;
