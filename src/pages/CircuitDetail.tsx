import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Row, Col, Statistic, Image, Tag } from 'antd';
import { ArrowLeftOutlined, FlagOutlined, ClockCircleOutlined, ThunderboltOutlined, CarOutlined, TrophyOutlined, CalendarOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useAppStore } from '@/store';
import { supabaseApi } from '@/api/supabase';
import type { Circuit, Race } from '@/types';
import dayjs from 'dayjs';

// 导入特殊赛道图片
import lasVegasBlack from '@/assets/circuits/black/las-vegas-1.svg';
import lasVegasOutline from '@/assets/circuits/black-outline/las-vegas-1.svg';
import austinBlack from '@/assets/circuits/black/austin-1.svg';
import austinOutline from '@/assets/circuits/black-outline/austin-1.svg';

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
const getCircuitImage = (circuitId: string, style: 'black-outline' | 'white-outline' | 'black' | 'white' = 'black-outline') => {
  // 硬编码特殊处理拉斯维加斯和美洲赛道
  if (circuitId === 'vegas' || circuitId === 'las_vegas') {
    return style === 'black' ? lasVegasBlack : lasVegasOutline;
  }
  if (circuitId === 'americas' || circuitId === 'austin') {
    return style === 'black' ? austinBlack : austinOutline;
  }

  // 特殊名称映射
  const mappedId = circuitNameMap[circuitId] || circuitId;

  // 处理不同的命名情况
  const idVariants = [
    mappedId.replace(/_/g, '-'), // 下划线转连字符
    mappedId, // 映射后的ID
    circuitId.replace(/_/g, '-'), // 原始ID转连字符
    circuitId, // 原始ID
    mappedId.replace('circuit', ''), // 移除circuit后缀
    mappedId.replace('_circuit', ''), // 移除_circuit后缀
    mappedId.split('_')[0], // 只取第一个部分
    circuitId.split('_')[circuitId.split('_').length - 1], // 只取最后一个部分
    // 特殊处理拉斯维加斯和美洲赛道
    circuitId === 'las_vegas' ? 'las-vegas-strip' : '',
    circuitId === 'vegas' ? 'las-vegas-strip' : '',
    circuitId === 'austin' ? 'circuit-of-the-americas' : '',
    circuitId === 'americas' ? 'circuit-of-the-americas' : '',
  ].filter(Boolean);

  // 去重
  const uniqueIds = [...new Set(idVariants)];

  // 尝试不同的版本号
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
        // 从Ergast获取当前赛季赛历
        const { seasonApi } = await import('@/api/ergast');
        const races = await seasonApi.getSeasonRaces(currentSeason);

        // 找到当前赛道的信息
        const matchedRace = races.find(race => race.Circuit.circuitId === circuitId);

        if (matchedRace) {
          setCircuit(matchedRace.Circuit);
          setCircuitRaces(races.filter(race => race.Circuit.circuitId === circuitId));
        }

        // 尝试从Supabase获取详细信息
        try {
          // ID映射（Ergast ID -> Supabase ID）
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
    return <div>加载中...</div>;
  }

  if (!circuit) {
    return <div>加载中...</div>;
  }

  return (
    <div>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(-1)}
        style={{ marginBottom: 24 }}
      >
        返回
      </Button>

      <Card loading={loading}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 48, marginBottom: 32, flexWrap: 'wrap' }}>
          <div style={{ flex: '0 0 auto', maxWidth: 400 }}>
            <Image
              src={getCircuitImage(circuit.circuitId, 'black')}
              alt={circuit.circuitName}
              style={{ width: '100%', background: '#f5f5f5', padding: 20, borderRadius: 8 }}
              fallback={<div style={{ width: 400, height: 300, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>暂无赛道图</div>}
            />
          </div>

          <div style={{ flex: 1, minWidth: 300 }}>
            <h1 style={{ fontSize: 40, marginBottom: 12 }}>{circuit.circuitName}</h1>
            <p style={{ fontSize: 20, color: '#666', marginBottom: 24 }}>
              {circuit.Location.locality}, {circuit.Location.country}
            </p>

            <Row gutter={[24, 16]} style={{ marginBottom: 32 }}>
              <Col xs={12} sm={6}>
                <Card>
                  <Statistic
                    title="赛道长度"
                    value={circuitDetails?.length || '未知'}
                    suffix="km"
                    prefix={<CarOutlined />}
                    valueStyle={{ color: '#52c41a' }}
                    formatter={(value) => value ? value.toString() : '-'}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card>
                  <Statistic
                    title="比赛圈数"
                    value={circuitDetails?.race_laps || '-'}
                    suffix="圈"
                    prefix={<ThunderboltOutlined />}
                    valueStyle={{ color: '#faad14' }}
                    formatter={(value) => value ? value.toString() : '-'}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card>
                  <Statistic
                    title="弯道数量"
                    value={circuitDetails?.turns || '-'}
                    suffix="个"
                    prefix={<FlagOutlined />}
                    valueStyle={{ color: '#722ed1' }}
                    formatter={(value) => value ? value.toString() : '-'}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card>
                  <Statistic
                    title="首次办赛"
                    value={circuitDetails?.first_race || '-'}
                    suffix="年"
                    prefix={<CalendarOutlined />}
                    valueStyle={{ color: '#13c2c2' }}
                    formatter={(value) => value ? value.toString() : '-'}
                  />
                </Card>
              </Col>
            </Row>

            <Row gutter={[24, 16]} style={{ marginBottom: 32 }}>
              <Col xs={12} sm={6}>
                <Card>
                  <Statistic
                    title="总举办场次"
                    value={circuitDetails?.total_races || '-'}
                    suffix="场"
                    prefix={<TrophyOutlined />}
                    valueStyle={{ color: '#1890ff' }}
                    formatter={(value) => value ? value.toString() : '-'}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card>
                  <Statistic
                    title="单圈记录"
                    value={circuitDetails?.lap_record || '暂无'}
                    prefix={<ClockCircleOutlined />}
                    valueStyle={{ color: '#f5222d' }}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card>
                  <Statistic
                    title="总距离"
                    value={circuitDetails?.total_distance || '未知'}
                    prefix={<CarOutlined />}
                    valueStyle={{ color: '#722ed1' }}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card>
                  <Statistic
                    title="记录保持者"
                    value={circuitDetails?.lap_record_driver || '暂无'}
                    prefix={<TrophyOutlined />}
                    valueStyle={{ color: '#13c2c2' }}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card>
                  <Statistic
                    title="记录年份"
                    value={circuitDetails?.lap_record_year || '暂无'}
                    suffix="年"
                    prefix={<CalendarOutlined />}
                    valueStyle={{ color: '#faad14' }}
                    formatter={(value) => value ? value.toString() : '-'}
                  />
                </Card>
              </Col>
            </Row>

            <Card title="比赛信息" style={{ marginBottom: 24 }}>
              {circuitRaces.length > 0 ? (
                <div>
                  <p><strong>本赛季比赛时间：</strong>{dayjs(circuitRaces[0].date).format('YYYY年MM月DD日')}</p>
                  <p><strong>比赛名称：</strong>{circuitRaces[0].race_name}</p>
                  {circuitRaces[0].is_sprint_weekend && <p><strong>赛事类型：</strong>冲刺赛周末</p>}
                </div>
              ) : (
                <p style={{ color: '#999' }}>本赛季没有安排比赛</p>
              )}
            </Card>
          </div>
        </div>

        <Card title="赛道布局预览" style={{ marginBottom: 24 }}>
          <Row gutter={[24, 24]}>
            <Col xs={24} sm={12} md={6}>
              <Card title="黑边轮廓" hoverable>
                <Image
                  src={getCircuitImage(circuit.circuitId, 'black-outline')}
                  alt="黑边轮廓"
                  style={{ width: '100%', height: 150, objectFit: 'contain' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card title="白边轮廓" hoverable>
                <Image
                  src={getCircuitImage(circuit.circuitId, 'white-outline')}
                  alt="白边轮廓"
                  style={{ width: '100%', height: 150, objectFit: 'contain', background: '#333', padding: 10, borderRadius: 4 }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card title="黑色填充" hoverable>
                <Image
                  src={getCircuitImage(circuit.circuitId, 'black')}
                  alt="黑色填充"
                  style={{ width: '100%', height: 150, objectFit: 'contain' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card title="白色填充" hoverable>
                <Image
                  src={getCircuitImage(circuit.circuitId, 'white')}
                  alt="白色填充"
                  style={{ width: '100%', height: 150, objectFit: 'contain', background: '#333', padding: 10, borderRadius: 4 }}
                />
              </Card>
            </Col>
          </Row>
        </Card>

        <Row gutter={[24, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} md={12}>
            <Card title="赛道基础信息">
              <p><strong>全称：</strong>{circuitDetails?.fullName || circuit.circuitName}</p>
              <p><strong>赛道方向：</strong>{circuitDetails?.direction === 'CLOCKWISE' ? '顺时针' : '逆时针'}</p>
              <p><strong>总赛程距离：</strong>{circuitDetails?.totalDistance || '待补充'}</p>
              <p><strong>举办F1场次：</strong>{circuitDetails?.totalRaces || '待补充'} 场</p>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card title="赛道纪录">
              <p>
                <strong>单圈纪录：</strong>
                <Tag color="blue">{circuitDetails?.lapRecord || '待补充'}</Tag>
              </p>
              <p><strong>纪录保持者：</strong>{circuitDetails?.lapRecordDriver || '待补充'}</p>
              <p><strong>创造年份：</strong>{circuitDetails?.lapRecordYear || '待补充'}</p>
            </Card>
          </Col>
        </Row>

        <Card title="基础信息">
          <Row gutter={[24, 16]}>
            <Col xs={24} sm={12}>
              <p><strong>赛道名称：</strong>{circuit.circuitName}</p>
              <p><strong>所在城市：</strong>{circuit.Location.locality}</p>
              <p><strong>所属国家：</strong>{circuit.Location.country}</p>
            </Col>
            <Col xs={24} sm={12}>
              <p><strong>地理坐标：</strong>{circuit.Location.lat}, {circuit.Location.long}</p>
              <p><strong>首次举办F1：</strong>{circuitDetails?.firstRace || '待补充'}</p>
              <p><strong>类型：</strong>{circuitDetails?.type === 'RACE' ? '永久赛道' : '街道赛道'}</p>
            </Col>
          </Row>
        </Card>
      </Card>
    </div>
  );
};

export default CircuitDetail;
