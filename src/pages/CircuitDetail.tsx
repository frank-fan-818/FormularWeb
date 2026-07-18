import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Button, Card, Spin, Tag } from 'antd';
import { ArrowLeftOutlined, CalendarOutlined, CarOutlined, FlagOutlined, TrophyOutlined } from '@ant-design/icons';
import { Helmet } from 'react-helmet-async';
import CircuitImage from '@/components/circuits/CircuitImage';
import { useCircuitDetailData } from '@/hooks';
import { useAppStore } from '@/store';
import type { Circuit, CircuitRouteState, Race } from '@/types';
import { formatRaceDateTimeFull } from '@/utils/raceSchedule';
import { formatCircuitDirection, getCircuitEnhancement } from '@/utils/circuitEnhancements';
import ProductMasthead from '@/components/product/ProductMasthead';
import ProductSectionHeader from '@/components/product/ProductSectionHeader';
import './CircuitDetail.css';

const TEXT = {
  unavailable: '\u8d5b\u9053\u6570\u636e\u6682\u65f6\u4e0d\u53ef\u7528',
  back: '\u8fd4\u56de',
  length: '\u8d5b\u9053\u957f\u5ea6',
  turns: '\u5f2f\u9053\u6570\u91cf',
  leftRightTurns: '\u5de6/\u53f3\u5f2f',
  direction: '\u8d5b\u9053\u65b9\u5411',
  totalDistance: '\u6bd4\u8d5b\u603b\u91cc\u7a0b',
  elevation: '\u9ad8\u4f4e\u843d\u5dee',
  raceCount: '\u4e3e\u529e\u6b21\u6570',
  firstRace: '\u9996\u6b21\u529e\u8d5b',
  lapRecord: '\u6b63\u8d5b\u6700\u5feb\u5355\u5708',
  unknown: '\u672a\u77e5',
  pendingData: '\u8d44\u6599\u5f85\u8865',
  seasonRace: '\u672c\u8d5b\u5b63\u6bd4\u8d5b',
  raceDate: '\u6bd4\u8d5b\u65f6\u95f4',
  raceType: '\u8d5b\u4e8b\u7c7b\u578b',
  sprintWeekend: '\u51b2\u523a\u8d5b\u5468\u672b',
  loading: '\u52a0\u8f7d\u4e2d...',
  loadingStat: '\u6b63\u5728\u8bfb\u53d6',
  error: '\u52a0\u8f7d\u8d5b\u9053\u8be6\u60c5\u5931\u8d25:',
};

type CircuitRaceWithMetadata = Race & {
  is_sprint_weekend?: boolean;
};

function isCircuit(value: unknown): value is Circuit {
  if (!value || typeof value !== 'object') return false;
  const circuit = value as Partial<Circuit>;
  return typeof circuit.circuitId === 'string'
    && typeof circuit.circuitName === 'string'
    && Boolean(circuit.Location && typeof circuit.Location === 'object');
}

function getCircuitRouteState(value: unknown): CircuitRouteState | null {
  if (!value || typeof value !== 'object') return null;
  const circuit = (value as { circuit?: unknown }).circuit;
  return isCircuit(circuit) ? { circuit } : null;
}

function hasDisplayValue(value: unknown): boolean {
  return value !== null && value !== undefined && String(value).trim() !== '' && String(value).trim() !== '-';
}

function formatStatValue(value: unknown, suffix = '', isLoading = false): string {
  if (!hasDisplayValue(value)) {
    if (isLoading) {
      return TEXT.loadingStat;
    }

    return TEXT.pendingData;
  }

  return `${value}${suffix}`;
}

const CircuitDetail = () => {
  const { circuitId } = useParams<{ circuitId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentSeason } = useAppStore();
  const {
    circuit,
    circuitDetails,
    circuitRaces,
    loading,
    detailsLoading,
  } = useCircuitDetailData(circuitId, currentSeason, getCircuitRouteState(location.state));

  if (loading) {
    return (
      <div className="circuit-detail-container">
        <Helmet>
          <title>&#x8d5b;&#x9053;&#x8be6;&#x60c5; &#8212; F1 Dashboard</title>
          <meta name="description" content="F1&#x8d5b;&#x9053;&#x8be6;&#x60c5;, &#x8d5b;&#x9053;&#x957f;&#x5ea6;&#x3001;&#x5f2f;&#x9053;&#x6570;&#x91cf;&#x3001;&#x5386;&#x53f2;&#x6570;&#x636e;&#x7b49;" />
        </Helmet>
        <div className="loading-container">
          <Spin size="large" />
          <div style={{ marginTop: 12 }}>{TEXT.loading}</div>
        </div>
      </div>
    );
  }

  if (!circuit) {
    return (
      <div className="circuit-detail-container">
        <Helmet>
          <title>&#x8d5b;&#x9053;&#x8be6;&#x60c5; &#8212; F1 Dashboard</title>
          <meta name="description" content="F1&#x8d5b;&#x9053;&#x8be6;&#x60c5;, &#x8d5b;&#x9053;&#x957f;&#x5ea6;&#x3001;&#x5f2f;&#x9053;&#x6570;&#x91cf;&#x3001;&#x5386;&#x53f2;&#x6570;&#x636e;&#x7b49;" />
        </Helmet>
        <div className="loading-container">{TEXT.unavailable}</div>
      </div>
    );
  }

  const enhancement = getCircuitEnhancement(circuit.circuitId);
  const leftRightTurns = enhancement.leftTurns !== undefined && enhancement.rightTurns !== undefined
    ? `${enhancement.leftTurns}L / ${enhancement.rightTurns}R`
    : TEXT.pendingData;
  const elevation = enhancement.elevationChangeM !== undefined
    ? `${enhancement.elevationChangeM} m`
    : TEXT.pendingData;
  const currentSeasonRace = circuitRaces[0] as CircuitRaceWithMetadata | undefined;
  const waitingForDetails = detailsLoading && !circuitDetails;
  const direction = waitingForDetails ? TEXT.loadingStat : formatCircuitDirection(circuitDetails?.direction);

  return (
    <div className="circuit-detail-container circuit-engineering-page">
      <Helmet>
        <title>{circuit?.circuitName ? `${circuit.circuitName} \u2014 F1 Dashboard` : '\u8d5b\u9053\u8be6\u60c5 \u2014 F1 Dashboard'}</title>
        <meta name="description" content={`${circuit?.circuitName || ''} F1\u8d5b\u9053\u8be6\u60c5, \u8d5b\u9053\u957f\u5ea6\u3001\u5f2f\u9053\u6570\u91cf\u3001\u5386\u53f2\u6570\u636e\u7b49`} />
      </Helmet>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(-1)}
        className="back-button"
      >
        {TEXT.back}
      </Button>

      <ProductMasthead
        index="05"
        eyebrow={`${currentSeason} / TRACK DOSSIER`}
        title={<>{circuit.circuitName}</>}
        description={`${circuit.Location.locality}, ${circuit.Location.country}。从赛道几何、方向与落差开始，理解这里为什么会形成独特的排位赛和正赛节奏。`}
        accent="var(--race-control-apex)"
        aside={(
          <div className="circuit-command-map">
            <CircuitImage alt={circuit.circuitName} circuitId={circuit.circuitId} className="circuit-image" showSectors />
            <div className="sector-legend" aria-label="Sector">
              <span><i className="sector-dot sector-dot-1" />S1</span>
              <span><i className="sector-dot sector-dot-2" />S2</span>
              <span><i className="sector-dot sector-dot-3" />S3</span>
            </div>
          </div>
        )}
        metrics={[
          { label: TEXT.length, value: formatStatValue(circuitDetails?.length, ' km', waitingForDetails), accent: 'var(--race-control-apex)' },
          { label: TEXT.turns, value: formatStatValue(circuitDetails?.turns, '', waitingForDetails) },
          { label: TEXT.direction, value: direction },
          { label: TEXT.raceCount, value: formatStatValue(circuitDetails?.total_races, '', waitingForDetails), detail: `${TEXT.firstRace} ${formatStatValue(circuitDetails?.first_race, '', waitingForDetails)}` },
        ]}
      />

      <h1 className="page-title"><span>{circuit.circuitName}</span></h1>
      <p className="page-subtitle">{circuit.Location.locality}, {circuit.Location.country}</p>

      <ProductSectionHeader index="01" eyebrow="TECHNICAL SHEET" title="赛道工程参数" description="几何结构与比赛距离是理解赛道特征的第一层证据。" />
      <div className="content-grid">
        <Card className="circuit-image-card">
          <div className="circuit-image-wrapper">
            <CircuitImage
              alt={circuit.circuitName}
              circuitId={circuit.circuitId}
              className="circuit-image"
              showSectors
            />
            <div className="sector-legend" aria-label="Sector">
              <span><i className="sector-dot sector-dot-1" />S1</span>
              <span><i className="sector-dot sector-dot-2" />S2</span>
              <span><i className="sector-dot sector-dot-3" />S3</span>
            </div>
          </div>
        </Card>

        <div className="stats-grid">
          <Card className="stat-card">
            <div className="stat-label">
              <CarOutlined /> {TEXT.length}
            </div>
            <div className="stat-value">
              {formatStatValue(circuitDetails?.length, ' km', waitingForDetails)}
            </div>
          </Card>

          <Card className="stat-card">
            <div className="stat-label">
              <FlagOutlined /> {TEXT.turns}
            </div>
            <div className="stat-value">
              {formatStatValue(circuitDetails?.turns, '', waitingForDetails)}
            </div>
          </Card>

          <Card className="stat-card">
            <div className="stat-label">
              <FlagOutlined /> {TEXT.leftRightTurns}
            </div>
            <div className="stat-value">
              {leftRightTurns}
            </div>
          </Card>

          <Card className="stat-card">
            <div className="stat-label">
              <FlagOutlined /> {TEXT.direction}
            </div>
            <div className="stat-value">
              {direction}
            </div>
          </Card>

          <Card className="stat-card">
            <div className="stat-label">
              <CarOutlined /> {TEXT.totalDistance}
            </div>
            <div className="stat-value">
              {formatStatValue(circuitDetails?.total_distance, '', waitingForDetails)}
            </div>
          </Card>

          <Card className="stat-card">
            <div className="stat-label">
              <FlagOutlined /> {TEXT.elevation}
            </div>
            <div className="stat-value">
              {elevation}
            </div>
          </Card>

          <Card className="stat-card">
            <div className="stat-label">
              <TrophyOutlined /> {TEXT.raceCount}
            </div>
            <div className="stat-value">
              {formatStatValue(circuitDetails?.total_races, '', waitingForDetails)}
            </div>
          </Card>

          <Card className="stat-card">
            <div className="stat-label">
              <CalendarOutlined /> {TEXT.firstRace}
            </div>
            <div className="stat-value">
              {formatStatValue(circuitDetails?.first_race, '', waitingForDetails)}
            </div>
          </Card>
        </div>
      </div>

      {circuitDetails?.lap_record ? (
        <>
          <h2 className="section-title">{TEXT.lapRecord}</h2>
          <Card className="lap-record-card">
            <div className="lap-record-content">
              <div className="lap-record-time">
                {circuitDetails.lap_record}
              </div>
              <div className="lap-record-info">
                <div className="lap-record-driver">
                  <TrophyOutlined /> {circuitDetails.lap_record_driver || TEXT.unknown}
                </div>
                <div className="lap-record-year">
                  <CalendarOutlined /> {circuitDetails.lap_record_year || TEXT.unknown}
                </div>
              </div>
            </div>
          </Card>
        </>
      ) : null}

      {currentSeasonRace ? (
        <>
          <h2 className="section-title">{TEXT.seasonRace}</h2>
          <Card className="race-info-card">
            <div className="race-info-item">
              <span className="race-info-label">{TEXT.raceDate}</span>
              <span className="race-info-value">
                {formatRaceDateTimeFull(currentSeasonRace)}
              </span>
            </div>
            {currentSeasonRace.is_sprint_weekend ? (
              <div className="race-info-item">
                <span className="race-info-label">{TEXT.raceType}</span>
                <span className="race-info-value">
                  <Tag color="orange">{TEXT.sprintWeekend}</Tag>
                </span>
              </div>
            ) : null}
          </Card>
        </>
      ) : null}
    </div>
  );
};

export default CircuitDetail;
