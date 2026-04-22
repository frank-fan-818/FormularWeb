import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Spin } from 'antd';
import { EnvironmentOutlined } from '@ant-design/icons';
import { useSeasonData } from '@/hooks';
import { supabaseApi } from '@/api/supabase';
import { useAppStore } from '@/store';
import { getSupabaseCircuitId } from '@/utils/circuitIds';
import './Circuits.css';

const TEXT = {
  title: '\u8d5b\u9053',
  loadError: '\u52a0\u8f7d\u8d5b\u9053\u5217\u8868\u5931\u8d25:',
};

const Circuits = () => {
  const navigate = useNavigate();
  const { currentSeason } = useAppStore();
  const { races, loading: seasonLoading } = useSeasonData(currentSeason);
  const [circuits, setCircuits] = useState<any[]>([]);
  const [pageLoading, setPageLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      if (seasonLoading) {
        return;
      }

      if (races.length === 0) {
        setCircuits([]);
        return;
      }

      setPageLoading(true);

      try {
        const supabaseCircuits = await supabaseApi.circuits.getAll();
        const circuitMap = new Map(supabaseCircuits.map((circuit) => [circuit.circuit_id, circuit]));

        const formattedCircuits = races.map((race, index) => {
          const ergastId = race.Circuit.circuitId;
          const supabaseId = getSupabaseCircuitId(ergastId);
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

        if (!cancelled) {
          setCircuits(formattedCircuits);
        }
      } catch (error) {
        console.error(TEXT.loadError, error);
        if (!cancelled) {
          setCircuits([]);
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
  }, [races, seasonLoading]);

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
