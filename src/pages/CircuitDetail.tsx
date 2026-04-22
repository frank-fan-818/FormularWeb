import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Spin, Tag } from 'antd';
import { ArrowLeftOutlined, CalendarOutlined, CarOutlined, FlagOutlined, TrophyOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import CircuitImage from '@/components/circuits/CircuitImage';
import { supabaseApi } from '@/api/supabase';
import { useSeasonData } from '@/hooks';
import { useAppStore } from '@/store';
import type { Circuit } from '@/types';
import { areCircuitIdsEquivalent, getSupabaseCircuitId } from '@/utils/circuitIds';
import './CircuitDetail.css';

const TEXT = {
  unavailable: '\u8d5b\u9053\u6570\u636e\u6682\u65f6\u4e0d\u53ef\u7528',
  back: '\u8fd4\u56de',
  length: '\u8d5b\u9053\u957f\u5ea6',
  turns: '\u5f2f\u9053\u6570\u91cf',
  raceCount: '\u4e3e\u529e\u6b21\u6570',
  firstRace: '\u9996\u6b21\u529e\u8d5b',
  lapRecord: '\u6b63\u8d5b\u6700\u5feb\u5355\u5708',
  unknown: '\u672a\u77e5',
  seasonRace: '\u672c\u8d5b\u5b63\u6bd4\u8d5b',
  raceDate: '\u6bd4\u8d5b\u65f6\u95f4',
  raceType: '\u8d5b\u4e8b\u7c7b\u578b',
  sprintWeekend: '\u51b2\u523a\u8d5b\u5468\u672b',
  loading: '\u52a0\u8f7d\u4e2d...',
  error: '\u52a0\u8f7d\u8d5b\u9053\u8be6\u60c5\u5931\u8d25:',
};

const CircuitDetail = () => {
  const { circuitId } = useParams<{ circuitId: string }>();
  const navigate = useNavigate();
  const { currentSeason } = useAppStore();
  const { races, loading: seasonLoading } = useSeasonData(currentSeason);

  const [circuit, setCircuit] = useState<Circuit | null>(null);
  const [circuitDetails, setCircuitDetails] = useState<any>(null);
  const [circuitRaces, setCircuitRaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    if (!circuitId) {
      setCircuit(null);
      setCircuitDetails(null);
      setCircuitRaces([]);
      setLoading(false);
      setDetailsLoading(false);
      return;
    }

    if (seasonLoading) {
      return;
    }

    let cancelled = false;

    const matchedCircuitRaces = races.filter((race) => areCircuitIdsEquivalent(race.Circuit.circuitId, circuitId));
    const matchedRace = matchedCircuitRaces[0] || null;

    setCircuit(matchedRace ? matchedRace.Circuit : null);
    setCircuitRaces(matchedCircuitRaces);
    setCircuitDetails(null);
    setLoading(!matchedRace);
    setDetailsLoading(true);

    const loadCircuitDetails = async () => {
      try {
        const supabaseId = getSupabaseCircuitId(circuitId);
        const supabaseCircuit = await supabaseApi.circuits.getById(supabaseId);

        if (cancelled) {
          return;
        }

        setCircuitDetails(supabaseCircuit);

        if (!matchedRace && supabaseCircuit) {
          setCircuit({
            circuitId: supabaseCircuit.circuit_id || supabaseId,
            url: '#',
            circuitName: supabaseCircuit.name,
            Location: {
              locality: supabaseCircuit.locality || supabaseCircuit.location || '',
              country: supabaseCircuit.country || '',
              lat: String(supabaseCircuit.lat || ''),
              long: String(supabaseCircuit.long || supabaseCircuit.lng || ''),
            },
          });
        }

        if (!matchedRace && !supabaseCircuit) {
          setCircuit(null);
        }
      } catch (error) {
        console.error(TEXT.error, error);

        if (cancelled) {
          return;
        }

        setCircuitDetails(null);
        if (!matchedRace) {
          setCircuit(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setDetailsLoading(false);
        }
      }
    };

    void loadCircuitDetails();

    return () => {
      cancelled = true;
    };
  }, [circuitId, races, seasonLoading]);

  if (seasonLoading || (loading && !circuit)) {
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
            />
          </div>
        </Card>

        <div className="stats-grid">
          <Card className="stat-card" loading={detailsLoading}>
            <div className="stat-label">
              <CarOutlined /> {TEXT.length}
            </div>
            <div className="stat-value">
              {circuitDetails?.length || '-'} km
            </div>
          </Card>

          <Card className="stat-card" loading={detailsLoading}>
            <div className="stat-label">
              <FlagOutlined /> {TEXT.turns}
            </div>
            <div className="stat-value">
              {circuitDetails?.turns || '-'}
            </div>
          </Card>

          <Card className="stat-card" loading={detailsLoading}>
            <div className="stat-label">
              <TrophyOutlined /> {TEXT.raceCount}
            </div>
            <div className="stat-value">
              {circuitDetails?.total_races || '-'}
            </div>
          </Card>

          <Card className="stat-card" loading={detailsLoading}>
            <div className="stat-label">
              <CalendarOutlined /> {TEXT.firstRace}
            </div>
            <div className="stat-value">
              {circuitDetails?.first_race || '-'}
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

      {circuitRaces.length > 0 ? (
        <>
          <h2 className="section-title">{TEXT.seasonRace}</h2>
          <Card className="race-info-card">
            <div className="race-info-item">
              <span className="race-info-label">{TEXT.raceDate}</span>
              <span className="race-info-value">
                {dayjs(circuitRaces[0].date).format('YYYY-MM-DD')}
              </span>
            </div>
            {circuitRaces[0].is_sprint_weekend ? (
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
