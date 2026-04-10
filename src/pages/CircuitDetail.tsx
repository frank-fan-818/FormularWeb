import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Image, Spin, Tag } from 'antd';
import { ArrowLeftOutlined, CarOutlined, FlagOutlined, CalendarOutlined, TrophyOutlined } from '@ant-design/icons';
import { useAppStore } from '@/store';
import { supabaseApi } from '@/api/supabase';
import type { Circuit } from '@/types';
import dayjs from 'dayjs';
import './CircuitDetail.css';



const circuitNameMap: Record<string, string> = {
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
  'losail': 'lusail',
  'yas_marina': 'yas-marina',
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

const getCircuitImage = (circuitId: string, style: 'black-outline' | 'white-outline' | 'black' | 'white' = 'black-outline') => {

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
        const url = new URL(`../assets/circuits/${style}/${id}${version}.svg`, import.meta.url).href;
        return url;
      } catch (error) {
        continue;
      }
    }
  }

  return '';
};

const CircuitDetail = () => {
  const { circuitId } = useParams<{ circuitId: string }>();
  const navigate = useNavigate();
  const { currentSeason } = useAppStore();
  const [circuit, setCircuit] = useState<Circuit | null>(null);
  const [circuitDetails, setCircuitDetails] = useState<any>(null);
  const [circuitRaces, setCircuitRaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!circuitId) return;
      setLoading(true);

      try {
        const { seasonApi } = await import('@/api/ergast');
        const races = await seasonApi.getSeasonRaces(currentSeason);
        const matchedRace = races.find(race => race.Circuit.circuitId === circuitId);

        if (matchedRace) {
          setCircuit(matchedRace.Circuit);
          setCircuitRaces(races.filter(race => race.Circuit.circuitId === circuitId));
        }

        try {
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

          const supabaseId = idMapping[circuitId] || circuitId;
          const supabaseCircuit = await supabaseApi.circuits.getById(supabaseId);
          setCircuitDetails(supabaseCircuit);
        } catch (e) {
          console.log('Supabase详情获取失败');
        }
      } catch (error) {
        console.error('加载赛道详情失败:', error);
      }

      setLoading(false);
    };
    loadData();
  }, [circuitId, currentSeason]);

  if (loading) {
    return (
      <div className="circuit-detail-container">
        <div className="loading-container">
          <Spin size="large" />
        </div>
      </div>
    );
  }

  if (!circuit) {
    return (
      <div className="circuit-detail-container">
        <div className="loading-container">
          <Spin size="large" />
        </div>
      </div>
    );
  }

  return (
    <div className="circuit-detail-container">
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(-1)}
        className="back-button"
      >
        返回
      </Button>

      <h1 className="page-title">🏁 <span>{circuit.circuitName}</span></h1>
      <p className="page-subtitle">{circuit.Location.locality}, {circuit.Location.country}</p>

      <div className="content-grid">
        <Card className="circuit-image-card">
          <div className="circuit-image-wrapper">
            <Image
              src={getCircuitImage(circuit.circuitId, 'black-outline')}
              alt={circuit.circuitName}
              className="circuit-image"
              preview={false}
              fallback="暂无赛道图"
            />
          </div>
        </Card>

        <div className="stats-grid">
          <Card className="stat-card">
            <div className="stat-label">
              <CarOutlined /> 赛道长度
            </div>
            <div className="stat-value">
              {circuitDetails?.length || '-'} km
            </div>
          </Card>

          <Card className="stat-card">
            <div className="stat-label">
              <FlagOutlined /> 弯道数量
            </div>
            <div className="stat-value">
              {circuitDetails?.turns || '-'} 个
            </div>
          </Card>

          <Card className="stat-card">
            <div className="stat-label">
              <TrophyOutlined /> 总举办场次
            </div>
            <div className="stat-value">
              {circuitDetails?.total_races || '-'} 场
            </div>
          </Card>

          <Card className="stat-card">
            <div className="stat-label">
              <CalendarOutlined /> 首次办赛
            </div>
            <div className="stat-value">
              {circuitDetails?.first_race || '-'} 年
            </div>
          </Card>
        </div>
      </div>

      {circuitDetails?.lap_record && (
        <>
          <h2 className="section-title">⏱️ 正赛最快单圈纪录</h2>
          <Card className="lap-record-card">
            <div className="lap-record-content">
              <div className="lap-record-time">
                {circuitDetails.lap_record}
              </div>
              <div className="lap-record-info">
                <div className="lap-record-driver">
                  <TrophyOutlined /> {circuitDetails.lap_record_driver || '未知'}
                </div>
                <div className="lap-record-year">
                  <CalendarOutlined /> {circuitDetails.lap_record_year || '未知'} 年
                </div>
              </div>
            </div>
          </Card>
        </>
      )}

      {circuitRaces.length > 0 && (
        <>
          <h2 className="section-title">📅 本赛季比赛</h2>
          <Card className="race-info-card">
            <div className="race-info-item">
              <span className="race-info-label">比赛时间</span>
              <span className="race-info-value">
                {dayjs(circuitRaces[0].date).format('YYYY年MM月DD日')}
              </span>
            </div>
            {circuitRaces[0].is_sprint_weekend && (
              <div className="race-info-item">
                <span className="race-info-label">赛事类型</span>
                <span className="race-info-value">
                  <Tag color="orange">冲刺赛周末</Tag>
                </span>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
};

export default CircuitDetail;
