import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Button, Card, Spin, Tag } from 'antd';
import { ArrowLeftOutlined, CalendarOutlined, CarOutlined, FlagOutlined, TrophyOutlined } from '@ant-design/icons';
import CircuitImage from '@/components/circuits/CircuitImage';
import { useCircuitDetailData } from '@/hooks';
import { useAppStore } from '@/store';
import type { Race } from '@/types';
import { formatRaceDateTimeFull } from '@/utils/raceSchedule';
import { formatCircuitDirection, getCircuitEnhancement } from '@/utils/circuitEnhancements';
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
  } = useCircuitDetailData(circuitId, currentSeason, location.state as { circuit?: any } | null);

  if (loading) {
    return (
      <div className="circuit-detail-container">
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
    <div className="circuit-detail-container">
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(-1)}
        className="back-button"
      >
        {TEXT.back}
      </Button>

      <h1 className="page-title"><span>{circuit.circuitName}</span></h1>
      <p className="page-subtitle">{circuit.Location.locality}, {circuit.Location.country}</p>

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
