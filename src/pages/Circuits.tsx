import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Spin } from 'antd';
import { EnvironmentOutlined } from '@ant-design/icons';
import DocumentHead from '@/components/DocumentHead';
import { useSeasonRacesCached, useSupabaseMetadata } from '@/hooks';
import { supabaseApi } from '@/api/supabase';
import { preloadRoute } from '@/utils/routePreload';
import { useAppStore } from '@/store';
import { getSupabaseCircuitId } from '@/utils/circuitIds';
import type { Circuit, Race } from '@/types';
import CircuitImage from '@/components/circuits/CircuitImage';
import ProductMasthead from '@/components/product/ProductMasthead';
import ProductSectionHeader from '@/components/product/ProductSectionHeader';
import './Circuits.css';

interface CircuitAtlasItem extends Circuit {
  length: string | number | null;
  turns: string | number | null;
  first_race: string | number | null;
  total_races: string | number | null;
  race_laps: string | number | null;
  total_distance: string | number | null;
  lap_record: string | null;
  lap_record_driver: string | null;
  lap_record_year: string | number | null;
  _supabaseId: string;
  index: number;
}

function formatCircuitLength(value: string | number | null): string {
  if (value === null || value === '') return '--';
  const text = String(value).trim();
  return /\bkm$/i.test(text) ? text : `${text} km`;
}

const Circuits = () => {
  const navigate = useNavigate();
  const { currentSeason } = useAppStore();
  const { races, loading: racesLoading } = useSeasonRacesCached(currentSeason);
  const fetchCircuitMetadata = useCallback(
    () => supabaseApi.circuits.getListMetadata(),
    [],
  );
  const { data: circuitMetadata } = useSupabaseMetadata(
    'supabase-circuit-list-metadata',
    fetchCircuitMetadata,
    races.length > 0,
  );

  const circuits = useMemo<CircuitAtlasItem[]>(() => {
    const circuitMap = new Map(
      (circuitMetadata || []).map((circuit) => [circuit.circuit_id, circuit]),
    );

    return races.map((race, index) => {
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
  }, [races, circuitMetadata]);

  const loading = racesLoading && circuits.length === 0;

  return (
    <div className="list-page-container circuit-atlas-page">
      <DocumentHead title="赛道列表 — F1 Dashboard" description="F1赛道列表，查看各赛道信息和数据统计" />
      <ProductMasthead
        index="05"
        eyebrow={`${currentSeason} / CIRCUIT ATLAS`}
        title={<>TRACK<br />ENGINEERING</>}
        metrics={[
          { label: '\u672c\u5b63\u8d5b\u9053', value: circuits.length || '--', detail: `${currentSeason} CALENDAR` },
          { label: '\u5df2\u8865\u5145\u5de5\u7a0b\u6570\u636e', value: circuits.filter((circuit) => circuit.length).length || '--', detail: '\u957f\u5ea6 / \u5f2f\u9053 / \u7eaa\u5f55' },
          { label: '\u51b2\u523a\u5468\u672b', value: races.filter((race) => Boolean((race as Race & { Sprint?: unknown }).Sprint)).length || '0', detail: '\u7279\u6b8a\u8d5b\u5236' },
        ]}
      />
      {loading ? (
        <div className="loading-container">
          <Spin size="large" />
        </div>
      ) : circuits.length === 0 ? (
        <div className="circuit-atlas-empty">当前赛季暂无赛道数据。</div>
      ) : (
        <>
        <ProductSectionHeader index="01" eyebrow="CALENDAR MAP" title="赛道列表" />
        <div className="circuit-atlas-grid">
          {circuits.map((circuit) => (
            <Card
              key={circuit.circuitId}
              className="circuit-atlas-card"
              hoverable
              style={{ animationDelay: `${circuit.index * 0.06}s` }}
              onPointerEnter={() => preloadRoute(`/circuits/${circuit.circuitId}`)}
              onClick={() => navigate(`/circuits/${circuit.circuitId}`, { state: { circuit } })}
            >
              <div className="circuit-atlas-map" aria-hidden="true">
                <CircuitImage circuitId={circuit.circuitId} alt={circuit.circuitName} className="circuit-atlas-image" />
                <span className="circuit-atlas-index">T{String(circuit.index + 1).padStart(2, '0')}</span>
              </div>
              <div className="circuit-atlas-copy">
                <span className="circuit-atlas-country">{circuit.Location.country}</span>
                <h2>{circuit.circuitName}</h2>
                <p><EnvironmentOutlined /> {circuit.Location.locality}</p>
              </div>
              <div className="circuit-atlas-specs">
                <span><small>Length</small><strong>{formatCircuitLength(circuit.length)}</strong></span>
                <span><small>Turns</small><strong>{circuit.turns || '--'}</strong></span>
                <span><small>First GP</small><strong>{circuit.first_race || '--'}</strong></span>
              </div>
              <span className="circuit-atlas-open">VIEW DOSSIER &#8594;</span>
            </Card>
          ))}
        </div>
        </>
      )}
    </div>
  );
};

export default Circuits;
