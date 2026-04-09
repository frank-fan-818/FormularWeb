import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Spin } from 'antd';
import { GlobalOutlined, TrophyOutlined } from '@ant-design/icons';
import { useAppStore } from '@/store';
import { supabaseApi } from '@/api/supabase';
import type { Constructor } from '@/types';
import { getTeamColor } from '@/utils/teamColors';
import './Constructors.css';

const Constructors = () => {
  const navigate = useNavigate();
  const { currentSeason } = useAppStore();
  const [constructors, setConstructors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      try {
        const { seasonApi } = await import('@/api/ergast');
        const standings = await seasonApi.getConstructorStandings(currentSeason);

        const supabaseConstructors = await supabaseApi.constructors.getAll();
        const constructorMap = new Map(supabaseConstructors.map(c => [c.constructor_id, c]));

        const formattedConstructors = standings.map((s, index) => {
          const dbConstructor = constructorMap.get(s.Constructor.constructorId);
          return {
            ...s.Constructor,
            total_wins: dbConstructor?.total_wins || null,
            total_podiums: dbConstructor?.total_podiums || null,
            total_pole_positions: dbConstructor?.total_pole_positions || null,
            total_fastest_laps: dbConstructor?.total_fastest_laps || null,
            total_race_entries: dbConstructor?.total_race_entries || null,
            index,
          };
        });

        setConstructors(formattedConstructors);
      } catch (error) {
        console.error('加载车队失败:', error);
        setConstructors([]);
      }

      setLoading(false);
    };
    loadData();
  }, [currentSeason]);

  return (
    <div className="list-page-container">
      <h1 className="page-title">🏭 <span>车队库</span></h1>

      {loading ? (
        <div className="loading-container">
          <Spin size="large" />
        </div>
      ) : (
        <div className="list-container">
          {constructors.map((constructor) => (
            <Card
              key={constructor.constructorId}
              className="list-item"
              hoverable
              style={{
                animationDelay: `${constructor.index * 0.08}s`,
                borderLeft: `4px solid ${getTeamColor(constructor.constructorId)}`
              }}
              onClick={() => navigate(`/constructors/${constructor.constructorId}`)}
            >
              <div className="item-content">
                <div className="item-left">
                  <div className="item-info">
                    <h3 className="item-title">
                      {constructor.name}
                    </h3>
                    <div className="item-stats">
                      <span className="stat-item"><GlobalOutlined /> {constructor.nationality}</span>
                      {constructor.total_wins && (
                        <span className="stat-item"><TrophyOutlined /> {constructor.total_wins} 胜</span>
                      )}
                      {constructor.total_podiums && (
                        <span className="stat-item">🥈 {constructor.total_podiums} 领奖台</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="item-right">
                  {constructor.total_race_entries && (
                    <div className="stat-badge" style={{ background: getTeamColor(constructor.constructorId) }}>
                      <span className="stat-value">{constructor.total_race_entries}</span>
                      <span className="stat-label">参赛场次</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Constructors;
