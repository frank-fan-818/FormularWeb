import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Image, Spin } from 'antd';
import { EnvironmentOutlined, CarOutlined, FlagOutlined, CalendarOutlined } from '@ant-design/icons';
import { useAppStore } from '@/store';
import { supabaseApi } from '@/api/supabase';
import './Circuits.css';

// 特殊赛道名称映射（全覆盖所有F1赛道）
const circuitNameMap: Record<string, string> = {
  // 2025赛季赛道
  'albert_park': 'melbourne',
  'bahrain': 'bahrain',
  'jeddah_corniche': 'jeddah',
  'suzuka': 'suzuka',
  'shanghai': 'shanghai',
  'miami': 'miami',
  'imola': 'imola',
  'monaco': 'monaco',
  'catalunya': 'catalunya',
  'villeneuve': 'montreal',
  'red_bull_ring': 'spielberg',
  'silverstone': 'silverstone',
  'hungaroring': 'hungaroring',
  'spa': 'spa-francorchamps',
  'spa_francorchamps': 'spa-francorchamps',
  'zandvoort': 'zandvoort',
  'monza': 'monza',
  'baku': 'baku',
  'marina_bay': 'marina-bay',
  'austin': 'austin',
  'rodriguez': 'mexico-city',
  'interlagos': 'interlagos',
  'las_vegas': 'las-vegas',
  'vegas': 'las-vegas-strip',
  'americas': 'circuit-of-the-americas',
  'losail': 'lusail',
  'yas_marina': 'yas-marina',

  // 历史赛道
  'sepang': 'sepang',
  'yeongam': 'yeongam',
  'buddh': 'buddh',
  'magny_cours': 'magny-cours',
  'paul_ricard': 'paul-ricard',
  'estoril': 'estoril',
  'istanbul_park': 'istanbul',
  'valencia_street': 'valencia',
  'nurburgring': 'nurburgring',
  'hockenheim': 'hockenheimring',
  'indianapolis': 'indianapolis',
  'watkins_glen': 'watkins-glen',
  'long_beach': 'long-beach',
  'adelaide': 'adelaide',
  'brands_hatch': 'brands-hatch',
  'donington': 'donington',
  'kyalami': 'kyalami',
  'mugello': 'mugello',
  'portimao': 'portimao',
  'sochi': 'sochi',
  'zolder': 'zolder',
  'zeltweg': 'zeltweg',
};

// 获取赛道图片
const getCircuitImage = (circuitId: string) => {
  // 硬编码特殊处理拉斯维加斯和美洲赛道
  if (circuitId === 'vegas' || circuitId === 'las_vegas') {
    return new URL(`../assets/circuits/black-outline/las-vegas-1.svg`, import.meta.url).href;
  }
  if (circuitId === 'americas' || circuitId === 'austin') {
    return new URL(`../assets/circuits/black-outline/austin-1.svg`, import.meta.url).href;
  }

  const mappedId = circuitNameMap[circuitId] || circuitId;

  const idVariants = [
    mappedId.replace(/_/g, '-'),
    mappedId,
    circuitId.replace(/_/g, '-'),
    circuitId,
    mappedId.replace('circuit', ''),
    mappedId.replace('_circuit', ''),
    mappedId.split('_')[0],
    circuitId.split('_')[circuitId.split('_').length - 1],
    // 特殊处理拉斯维加斯和美洲赛道
    circuitId === 'las_vegas' ? 'las-vegas-strip' : '',
    circuitId === 'vegas' ? 'las-vegas-strip' : '',
    circuitId === 'austin' ? 'circuit-of-the-americas' : '',
    circuitId === 'americas' ? 'circuit-of-the-americas' : '',
  ].filter(Boolean);

  const uniqueIds = [...new Set(idVariants)];
  const versions = ['-1', '-2', '-3', '-4', ''];

  for (const id of uniqueIds) {
    for (const version of versions) {
      try {
        return new URL(`../assets/circuits/black-outline/${id}${version}.svg`, import.meta.url).href;
      } catch (error) {
        continue;
      }
    }
  }

  return '';
};

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
          'americas': 'austin'
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
      <h1 className="page-title">🏁 <span>赛道库</span></h1>

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
                  <div className="circuit-image-wrapper">
                    <Image
                      src={getCircuitImage(circuit.circuitId)}
                      alt={circuit.circuitName}
                      width={100}
                      height={70}
                      fallback="无图"
                      preview={false}
                    />
                  </div>
                  <div className="item-info">
                    <h3 className="item-title">
                      {circuit.circuitName}
                      {circuit.race_laps && <span className="item-tag">{circuit.race_laps} 圈</span>}
                    </h3>
                    <div className="item-stats">
                      <span className="stat-item"><EnvironmentOutlined /> {circuit.Location.locality}, {circuit.Location.country}</span>
                      {circuit.length && (
                        <span className="stat-item"><CarOutlined /> {circuit.length} km</span>
                      )}
                      {circuit.turns && (
                        <span className="stat-item"><FlagOutlined /> {circuit.turns} 个弯道</span>
                      )}
                      {circuit.first_race && (
                        <span className="stat-item"><CalendarOutlined /> 首次举办 {circuit.first_race} 年</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="item-right">
                  {circuit.total_races && (
                    <div className="stat-badge" style={{ color: '#ffffff' }}>
                      <span className="stat-value" style={{ color: '#ffffff' }}>{circuit.total_races}</span>
                      <span className="stat-label" style={{ color: '#ffffff' }}>举办场次</span>
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

export default Circuits;
