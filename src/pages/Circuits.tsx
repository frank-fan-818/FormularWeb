import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Spin } from 'antd';
import { EnvironmentOutlined } from '@ant-design/icons';
import { useAppStore } from '@/store';
import { supabaseApi } from '@/api/supabase';
import './Circuits.css';

const Circuits = () => {
  const navigate = useNavigate();
  const { currentSeason } = useAppStore();
  const [circuits, setCircuits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      try {
        const { seasonApi } = await import('@/api/ergast');
        const races = await seasonApi.getSeasonRaces(currentSeason);

        const supabaseCircuits = await supabaseApi.circuits.getAll();

        const idMapping: Record<string, string> = {
          'albert_park': 'melbourne',
          'red_bull_ring': 'spielberg',
          'spa': 'spa_francorchamps',
          'villeneuve': 'montreal',
          'rodriguez': 'mexico_city',
          'monaco_circuit': 'monaco',
          'losail': 'lusail',
          'vegas': 'las_vegas',
          'americas': 'austin',
          'paul_ricard': 'paul_ricard'
        };

        const circuitMap = new Map(supabaseCircuits.map(c => [c.circuit_id, c]));

        const formattedCircuits = races.map((race, index) => {
          const ergastId = race.Circuit.circuitId;
          const supabaseId = idMapping[ergastId] || ergastId;
          const dbCircuit = circuitMap.get(supabaseId);

          return {
            ...race.Circuit,
            length: dbCircuit?.length || null,
            turns: dbCircuit?.turns || null,
            first_race: dbCircuit?.first_race || null,
            total_races: dbCircuit?.total_races || null,
            race_laps: dbCircuit?.race_laps || null,
            total_distance: dbCircuit?.total_distance || null,
            lap_record: dbCircuit?.lap_record || null,
            lap_record_driver: dbCircuit?.lap_record_driver || null,
            lap_record_year: dbCircuit?.lap_record_year || null,
            _supabaseId: supabaseId,
            index,
          };
        });

        setCircuits(formattedCircuits);
      } catch (error) {
        console.error('加载赛道失败:', error);
        setCircuits([]);
      }

      setLoading(false);
    };
    loadData();
  }, [currentSeason]);

  return (
    <div className="list-page-container">
      <h1 className="page-title"><span>赛道库</span></h1>

      {loading ? (
        <div className="loading-container">
          <Spin size="large" />
        </div>
      ) : (
        <div className="list-container">
          {circuits.map((circuit) => (
            <Card
              key={circuit.circuitId}
              className="list-item"
              hoverable
              style={{ animationDelay: `${circuit.index * 0.06}s` }}
              onClick={() => navigate(`/circuits/${circuit.circuitId}`)}
            >
              <div className="item-content">
                <div className="item-left">
                  <div className="item-info">
                    <h3 className="item-title">
                      {circuit.circuitName}
                    </h3>
                    <div className="item-stats">
                      <span className="stat-item"><EnvironmentOutlined /> {circuit.Location.locality}, {circuit.Location.country}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Circuits;
