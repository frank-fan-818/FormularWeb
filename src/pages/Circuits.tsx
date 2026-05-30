import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Spin } from 'antd';
import { EnvironmentOutlined } from '@ant-design/icons';
import { Helmet } from 'react-helmet-async';
import { useSeasonRacesCached, useSupabaseMetadata } from '@/hooks';
import { supabaseApi } from '@/api/supabase';
import { useAppStore } from '@/store';
import { getSupabaseCircuitId } from '@/utils/circuitIds';
import './Circuits.css';

const TEXT = {
  title: '\u8d5b\u9053',
};

const Circuits = () => {
  const navigate = useNavigate();
  const { currentSeason } = useAppStore();
  const { races, loading: racesLoading } = useSeasonRacesCached(currentSeason);
  const [circuits, setCircuits] = useState<any[]>([]);
  const hasEnrichedRef = useRef(false);
  const fetchCircuitMetadata = useCallback(() => supabaseApi.circuits.getListMetadata(), []);
  const { data: circuitMetadata } = useSupabaseMetadata(
    'supabase-circuit-list-metadata',
    fetchCircuitMetadata,
    races.length > 0,
  );

  useEffect(() => {
    if (races.length === 0) return;

    const enrichWithMetadata = circuitMetadata && circuitMetadata.length > 0;
    const circuitMap = enrichWithMetadata
      ? new Map(circuitMetadata.map((circuit) => [circuit.circuit_id, circuit]))
      : null;

    const formattedCircuits = races.map((race, index) => {
      const ergastId = race.Circuit.circuitId;
      const supabaseId = getSupabaseCircuitId(ergastId);
      const dbCircuit = circuitMap?.get(supabaseId);

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

    // Only update if data actually changed or this is the first enrichment
    if (!enrichWithMetadata || !hasEnrichedRef.current) {
      setCircuits(formattedCircuits);
      if (enrichWithMetadata) {
        hasEnrichedRef.current = true;
      }
    }
  }, [races, circuitMetadata]);

  const loading = racesLoading && circuits.length === 0;

  return (
    <div className="list-page-container">
      <Helmet>
        <title>&#x8d5b;&#x9053;&#x5217;&#x8868; &#8212; F1 Dashboard</title>
        <meta name="description" content="F1&#x8d5b;&#x9053;&#x5217;&#x8868;, &#x67e5;&#x770b;&#x5404;&#x8d5b;&#x9053;&#x4fe1;&#x606f;&#x548c;&#x6570;&#x636e;&#x7edf;&#x8ba1;" />
      </Helmet>
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
              onClick={() => navigate(`/circuits/${circuit.circuitId}`, { state: { circuit } })}
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
