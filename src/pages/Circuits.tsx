import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from 'antd';
import { EnvironmentOutlined } from '@ant-design/icons';
import DocumentHead from '@/components/DocumentHead';
import { useSeasonRacesCached, useSupabaseMetadata } from '@/hooks';
import { supabaseApi } from '@/api/supabase';
import { preloadRoute } from '@/utils/routePreload';
import { useAppStore } from '@/store';
import { getSupabaseCircuitId } from '@/utils/circuitIds';
import { getCircuitDetailsSync } from '@/utils/circuitData';
import { getCircuitEnhancement } from '@/utils/circuitEnhancements';
import { firstCircuitValue } from '@/utils/circuitValues';
import type { Circuit } from '@/types';
import CircuitImage from '@/components/circuits/CircuitImage';
import ProductMasthead from '@/components/product/ProductMasthead';
import ProductSectionHeader from '@/components/product/ProductSectionHeader';
import { TimingBeacon } from '@/components/loading/TimingBeacon';
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
    'supabase-circuit-list-metadata-v2',
    fetchCircuitMetadata,
    true,
  );

  const circuits = useMemo<CircuitAtlasItem[]>(() => {
    const circuitMap = new Map(
      (circuitMetadata || []).map((circuit) => [circuit.circuit_id, circuit]),
    );

    return races.map((race, index) => {
      const ergastId = race.Circuit.circuitId;
      const supabaseId = getSupabaseCircuitId(ergastId);
      const dbCircuit = circuitMap.get(supabaseId);
      const localCircuit = getCircuitDetailsSync(supabaseId) || getCircuitDetailsSync(ergastId);
      const enhancement = getCircuitEnhancement(ergastId);
      const localTurns = localCircuit?.turns ?? (enhancement.leftTurns !== undefined && enhancement.rightTurns !== undefined
        ? enhancement.leftTurns + enhancement.rightTurns
        : null);

      return {
        ...race.Circuit,
        length: firstCircuitValue(dbCircuit?.length, localCircuit?.length) ?? null,
        turns: firstCircuitValue(dbCircuit?.turns, localTurns) ?? null,
        first_race: firstCircuitValue(dbCircuit?.first_race, localCircuit?.firstRace) ?? null,
        total_races: firstCircuitValue(dbCircuit?.total_races, localCircuit?.totalRaces) ?? null,
        race_laps: firstCircuitValue(dbCircuit?.race_laps, localCircuit?.raceLaps) ?? null,
        total_distance: firstCircuitValue(dbCircuit?.total_distance, localCircuit?.totalDistance) ?? null,
        lap_record: firstCircuitValue(dbCircuit?.lap_record, localCircuit?.lapRecord) ?? null,
        lap_record_driver: firstCircuitValue(dbCircuit?.lap_record_driver, localCircuit?.lapRecordDriver) ?? null,
        lap_record_year: firstCircuitValue(dbCircuit?.lap_record_year, localCircuit?.lapRecordYear) ?? null,
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
        title="TRACK ENGINEERING"
        metrics={[
          { label: '\u672c\u5b63\u8d5b\u9053', value: circuits.length || '--' },
        ]}
      />
      {loading ? (
        <div className="loading-container">
          <TimingBeacon label="Mapping championship circuits" detail={`${currentSeason} calendar · layouts · records`} />
        </div>
      ) : circuits.length === 0 ? (
        <div className="circuit-atlas-empty">当前赛季暂无赛道数据。</div>
      ) : (
        <>
        <ProductSectionHeader title="赛道列表" />
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
