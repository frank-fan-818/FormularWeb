import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Col, Row } from 'antd';
import { ArrowLeftOutlined, CarOutlined, FlagOutlined, TrophyOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { driverApi, seasonApi } from '@/api/ergast';
import { supabaseApi } from '@/api/supabase';
import { useSeasonData } from '@/hooks';
import { useAppStore } from '@/store';
import type { DriverStanding } from '@/types';
import { getTeamColor } from '@/utils/teamColors';
import './DriverDetail.css';

interface DriverProfile {
  driverId: string;
  permanentNumber: string;
  code: string;
  url: string;
  givenName: string;
  familyName: string;
  dateOfBirth: string;
  nationality: string;
  totalWins: number;
  totalPodiums: number;
  totalPolePositions: number;
  totalFastestLaps: number;
  totalRaceStarts: number;
}

const TEXT = {
  cumulativePoints: '\u7d2f\u8ba1\u79ef\u5206',
  racePoints: '\u6b63\u8d5b\u79ef\u5206',
  sprintPoints: '\u51b2\u523a\u79ef\u5206',
  roundTotal: '\u5355\u7ad9\u603b\u5206',
  back: '\u8fd4\u56de\u8f66\u624b\u5217\u8868',
  unavailable: '\u6682\u65f6\u65e0\u6cd5\u83b7\u53d6\u8be5\u8f66\u624b\u4fe1\u606f\u3002',
  seasonKeyStats: '\u8d5b\u5b63\u5173\u952e\u6570\u636e',
  seasonRank: '\u8d5b\u5b63\u6392\u540d',
  seasonPoints: '\u8d5b\u5b63\u79ef\u5206',
  seasonWins: '\u8d5b\u5b63\u80dc\u573a',
  pointsTrend: '\u8d5b\u5b63\u79ef\u5206\u8d70\u52bf',
  noTrendData: '\u6682\u65e0\u8d5b\u5b63\u79ef\u5206\u8d70\u52bf\u6570\u636e\u3002',
  careerStats: '\u804c\u4e1a\u751f\u6daf\u7edf\u8ba1',
  loadingCareerStats: '\u6b63\u5728\u8865\u5145\u5386\u53f2\u7edf\u8ba1...',
  loadedCareerStats: '\u5386\u53f2\u7edf\u8ba1\u5df2\u5b8c\u6210\u52a0\u8f7d\u3002',
  raceEntries: '\u53c2\u8d5b\u573a\u6b21',
  raceWins: '\u5206\u7ad9\u51a0\u519b',
  podiums: '\u767b\u4e0a\u9886\u5956\u53f0',
  poles: '\u6746\u4f4d\u6b21\u6570',
  driverInfo: '\u8f66\u624b\u4fe1\u606f',
  name: '\u59d3\u540d\uff1a',
  code: '\u7b80\u79f0\uff1a',
  number: '\u53f7\u7801\uff1a',
  nationality: '\u56fd\u7c4d\uff1a',
  birthDate: '\u51fa\u751f\u65e5\u671f\uff1a',
  currentTeam: '\u5f53\u524d\u8f66\u961f\uff1a',
  pointsUnit: '\u5206',
  chartLoading: '\u6b63\u5728\u52a0\u8f7d\u56fe\u8868...',
};

const LazyEChartsPanel = lazy(() => import('@/components/charts/EChartsPanel'));

function mapSupabaseDriver(driver: Record<string, any>): DriverProfile {
  return {
    driverId: driver.driver_id,
    permanentNumber: driver.permanent_number || '',
    code: driver.code || '',
    url: '#',
    givenName: driver.first_name || '',
    familyName: driver.last_name || '',
    dateOfBirth: driver.date_of_birth || '',
    nationality: driver.nationality || '',
    totalWins: driver.total_wins || 0,
    totalPodiums: driver.total_podiums || 0,
    totalPolePositions: driver.total_pole_positions || 0,
    totalFastestLaps: driver.total_fastest_laps || 0,
    totalRaceStarts: driver.total_race_starts || 0,
  };
}

function getDriverIdCandidates(driverId: string): string[] {
  const candidates = [driverId];
  if (driverId.includes('_')) {
    const parts = driverId.split('_');
    const tail = parts[parts.length - 1];
    if (tail) {
      candidates.push(tail);
    }
  }
  return [...new Set(candidates)];
}

function findStandingByDriverId(standings: DriverStanding[], driverId: string): DriverStanding | null {
  const candidates = getDriverIdCandidates(driverId);
  return standings.find((item) => candidates.includes(item.Driver.driverId)) || null;
}

async function resolveSupabaseDriverProfile(
  driverId: string,
  standing: DriverStanding | null,
): Promise<DriverProfile | null> {
  const exact = await supabaseApi.drivers.getById(driverId);
  if (exact) {
    return mapSupabaseDriver(exact);
  }

  if (!standing) {
    return null;
  }

  const allDrivers = await supabaseApi.drivers.getAll();
  const matched = allDrivers.find((item) =>
    item.first_name === standing.Driver.givenName
    && item.last_name === standing.Driver.familyName,
  );

  return matched ? mapSupabaseDriver(matched) : null;
}

async function resolveErgastDriverId(
  driverId: string,
  season: string,
  standing: DriverStanding | null,
): Promise<string> {
  if (standing) {
    return standing.Driver.driverId;
  }

  const candidates = getDriverIdCandidates(driverId);
  for (const candidate of candidates) {
    try {
      const seasonResults = await driverApi.getDriverSeasonRaceResults(candidate, season);
      if (seasonResults.length > 0) {
        return candidate;
      }
    } catch {
      // Ignore and continue checking other candidates.
    }
  }

  return driverId;
}

const DriverDetail = () => {
  const { driverId } = useParams<{ driverId: string }>();
  const navigate = useNavigate();
  const { currentSeason } = useAppStore();
  const { driverStandings, loading: seasonLoading } = useSeasonData(currentSeason);

  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [careerStats, setCareerStats] = useState({
    raceCount: 0,
    poleCount: 0,
    winCount: 0,
    championshipCount: 0,
    totalPoints: 0,
  });
  const [seasonRaceResults, setSeasonRaceResults] = useState<any[]>([]);
  const [seasonSprintResults, setSeasonSprintResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [careerStatsLoading, setCareerStatsLoading] = useState(false);
  const [chartHeight, setChartHeight] = useState(400);
  const [isMobile, setIsMobile] = useState(false);
  const [chartScale, setChartScale] = useState(1);
  const [chartEnabled, setChartEnabled] = useState(false);
  const [resolvedDriverId, setResolvedDriverId] = useState<string | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ distance: number; scale: number } | null>(null);

  const currentStanding = driverId ? findStandingByDriverId(driverStandings, driverId) : null;

  const getTouchDistance = (touches: React.TouchList): number => {
    return Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY,
    );
  };

  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    if (event.touches.length === 2) {
      const distance = getTouchDistance(event.touches);
      touchStartRef.current = { distance, scale: chartScale };
    }
  }, [chartScale]);

  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    if (event.touches.length === 2 && touchStartRef.current) {
      const currentDistance = getTouchDistance(event.touches);
      const scaleRatio = currentDistance / touchStartRef.current.distance;
      const newScale = Math.min(Math.max(touchStartRef.current.scale * scaleRatio, 0.5), 3);
      setChartScale(newScale);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    touchStartRef.current = null;
  }, []);

  useEffect(() => {
    const updateChartHeight = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      setChartHeight(mobile ? 300 : 400);
    };

    updateChartHeight();
    window.addEventListener('resize', updateChartHeight);
    return () => window.removeEventListener('resize', updateChartHeight);
  }, []);

  useEffect(() => {
    if (seasonRaceResults.length === 0) {
      setChartEnabled(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setChartEnabled(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [seasonRaceResults.length]);

  useEffect(() => {
    if (!driverId || seasonLoading) {
      return;
    }

    let cancelled = false;

    setLoading(true);
    setCareerStatsLoading(false);
    setResolvedDriverId(null);
    setSeasonRaceResults([]);
    setSeasonSprintResults([]);

    const loadPrimaryData = async () => {
      const [baseDriverResult, resolvedDriverIdResult, sprintResultsResult] = await Promise.allSettled([
        resolveSupabaseDriverProfile(driverId, currentStanding),
        resolveErgastDriverId(driverId, currentSeason, currentStanding),
        seasonApi.getSeasonSprintResults(currentSeason),
      ]);

      const baseDriver = baseDriverResult.status === 'fulfilled' ? baseDriverResult.value : null;
      const nextResolvedDriverId = resolvedDriverIdResult.status === 'fulfilled'
        ? resolvedDriverIdResult.value
        : driverId;

      const raceResultsResult = await Promise.allSettled([
        driverApi.getDriverSeasonRaceResults(nextResolvedDriverId, currentSeason),
      ]);

      if (cancelled) {
        return;
      }

      const mergedDriver = currentStanding ? {
        ...currentStanding.Driver,
        ...baseDriver,
        totalWins: baseDriver?.totalWins ?? 0,
        totalPodiums: baseDriver?.totalPodiums ?? 0,
        totalPolePositions: baseDriver?.totalPolePositions ?? 0,
        totalFastestLaps: baseDriver?.totalFastestLaps ?? 0,
        totalRaceStarts: baseDriver?.totalRaceStarts ?? 0,
      } : baseDriver;

      setDriver(mergedDriver);
      setResolvedDriverId(nextResolvedDriverId);

      if (raceResultsResult[0].status === 'fulfilled') {
        setSeasonRaceResults(
          raceResultsResult[0].value.sort(
            (left, right) => parseInt(left.round, 10) - parseInt(right.round, 10),
          ),
        );
      } else {
        setSeasonRaceResults([]);
      }

      if (sprintResultsResult.status === 'fulfilled') {
        setSeasonSprintResults(sprintResultsResult.value);
      } else {
        setSeasonSprintResults([]);
      }

      setCareerStats({
        raceCount: mergedDriver?.totalRaceStarts || 0,
        poleCount: mergedDriver?.totalPolePositions || 0,
        winCount: mergedDriver?.totalWins || 0,
        championshipCount: 0,
        totalPoints: 0,
      });

      setLoading(false);
    };

    void loadPrimaryData();

    return () => {
      cancelled = true;
    };
  }, [currentSeason, currentStanding, driverId, seasonLoading]);

  useEffect(() => {
    if (!resolvedDriverId) {
      return;
    }

    let cancelled = false;

    setCareerStatsLoading(true);

    const loadCareerStats = async () => {
      const [
        raceCount,
        poleCount,
        winCount,
        podiumCount,
        championshipCount,
        totalPoints,
      ] = await Promise.allSettled([
        driverApi.getDriverRaceCount(resolvedDriverId),
        driverApi.getDriverPoleCount(resolvedDriverId),
        driverApi.getDriverWinCount(resolvedDriverId),
        driverApi.getDriverPodiumCount(resolvedDriverId),
        driverApi.getDriverChampionshipCount(resolvedDriverId),
        driverApi.getDriverTotalPoints(resolvedDriverId),
      ]);

      if (cancelled) {
        return;
      }

      setCareerStats((previous) => ({
        raceCount: raceCount.status === 'fulfilled' ? raceCount.value : previous.raceCount,
        poleCount: poleCount.status === 'fulfilled' ? poleCount.value : previous.poleCount,
        winCount: winCount.status === 'fulfilled' ? winCount.value : previous.winCount,
        championshipCount: championshipCount.status === 'fulfilled'
          ? championshipCount.value
          : previous.championshipCount,
        totalPoints: totalPoints.status === 'fulfilled' ? totalPoints.value : previous.totalPoints,
      }));

      if (podiumCount.status === 'fulfilled') {
        setDriver((previous) => (
          previous ? { ...previous, totalPodiums: podiumCount.value } : previous
        ));
      }

      setCareerStatsLoading(false);
    };

    void loadCareerStats();

    return () => {
      cancelled = true;
    };
  }, [currentSeason, resolvedDriverId]);

  const teamColor = currentStanding?.Constructors[0]?.constructorId
    ? getTeamColor(currentStanding.Constructors[0].constructorId)
    : '#1890ff';

  const getPointsChartOption = () => {
    let cumulativePoints = 0;
    const raceNames: string[] = [];
    const singlePoints: number[] = [];
    const cumulativePointsArr: number[] = [];
    const totalPoints = currentStanding ? parseFloat(currentStanding.points) : 0;

    const sprintPointsMap: Record<string, number> = {};
    seasonSprintResults.forEach((sprintRace) => {
      if (sprintRace.SprintResults && sprintRace.SprintResults.length > 0) {
        const driverResult = sprintRace.SprintResults.find((result: any) => result.Driver.driverId === resolvedDriverId);
        if (driverResult) {
          sprintPointsMap[sprintRace.round] = parseFloat(driverResult.points);
        }
      }
    });

    seasonRaceResults.forEach((race) => {
      raceNames.push(race.raceName.replace(' Grand Prix', ''));
      let raceTotalPoints = 0;

      if (race.Results && race.Results.length > 0) {
        raceTotalPoints += parseFloat(race.Results[0].points);
      }

      if (sprintPointsMap[race.round]) {
        raceTotalPoints += sprintPointsMap[race.round];
      }

      singlePoints.push(raceTotalPoints);
      cumulativePoints += raceTotalPoints;
      cumulativePointsArr.push(cumulativePoints);
    });

    if (cumulativePointsArr.length > 0 && totalPoints > 0) {
      cumulativePointsArr[cumulativePointsArr.length - 1] = totalPoints;
    }

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#f0f0f0',
        borderWidth: 1,
        textStyle: {
          color: '#262626',
          fontSize: 13,
        },
        padding: [12, 16],
        extraCssText: 'box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15); border-radius: 8px;',
        formatter: (params: any) => {
          const index = params[0].dataIndex;
          const round = seasonRaceResults[index]?.round;
          const sprintPoints = sprintPointsMap[round] || 0;
          const racePoints = singlePoints[index] - sprintPoints;

          let result = `<div style="font-weight: 600; margin-bottom: 8px; font-size: 14px;">${params[0].name}</div>`;
          result += `<div style="display: flex; justify-content: space-between; gap: 20px; margin-bottom: 4px;"><span>${TEXT.racePoints}:</span><span style="font-weight: 600;">${racePoints}</span></div>`;
          if (sprintPoints > 0) {
            result += `<div style="display: flex; justify-content: space-between; gap: 20px; margin-bottom: 4px;"><span>${TEXT.sprintPoints}:</span><span style="font-weight: 600; color: #52c41a;">+${sprintPoints}</span></div>`;
          }
          result += `<div style="display: flex; justify-content: space-between; gap: 20px; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #f0f0f0;"><span>${TEXT.roundTotal}:</span><span style="font-weight: 600;">${singlePoints[index]}</span></div>`;
          result += `<div style="display: flex; justify-content: space-between; gap: 20px; align-items: center;"><span style="display: flex; align-items: center; gap: 6px;"><span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${teamColor};"></span>${TEXT.cumulativePoints}:</span><span style="font-weight: 700; font-size: 16px; color: ${teamColor};">${params[0].value}</span></div>`;
          return result;
        },
      },
      legend: {
        data: [TEXT.cumulativePoints],
        top: 0,
        right: 0,
        textStyle: {
          color: '#595959',
          fontSize: 13,
        },
      },
      grid: {
        left: '2%',
        right: '3%',
        bottom: '8%',
        top: '50px',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: raceNames,
        axisLine: {
          lineStyle: {
            color: '#e8e8e8',
          },
        },
        axisTick: {
          show: false,
        },
        axisLabel: {
          rotate: 45,
          interval: 0,
          color: '#8c8c8c',
          fontSize: 11,
          fontWeight: 500,
        },
      },
      yAxis: {
        type: 'value',
        name: TEXT.cumulativePoints,
        nameTextStyle: {
          color: '#8c8c8c',
          fontSize: 12,
          padding: [0, 0, 0, -30],
        },
        axisLine: {
          show: false,
        },
        axisTick: {
          show: false,
        },
        splitLine: {
          lineStyle: {
            color: '#f0f0f0',
            type: 'dashed',
          },
        },
        axisLabel: {
          color: '#8c8c8c',
          fontSize: 11,
        },
        min: 0,
        max: (value: { max: number }) => {
          const maxVal = Math.max(value.max, totalPoints) * 1.1;
          return Math.ceil(maxVal / 10) * 10;
        },
        interval: (value: { max: number }) => {
          const maxVal = Math.max(value.max, totalPoints) * 1.1;
          const roundedMax = Math.ceil(maxVal / 10) * 10;
          return Math.ceil(roundedMax / 5 / 10) * 10;
        },
      },
      series: [
        {
          name: TEXT.cumulativePoints,
          type: 'line',
          data: cumulativePointsArr,
          smooth: 0.4,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: {
            width: 4,
            color: teamColor,
            shadowColor: `${teamColor}40`,
            shadowBlur: 10,
            shadowOffsetY: 4,
          },
          itemStyle: {
            color: teamColor,
            borderWidth: 2,
            borderColor: '#fff',
          },
          emphasis: {
            scale: 1.5,
            itemStyle: {
              borderWidth: 3,
              shadowBlur: 15,
              shadowColor: teamColor,
            },
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: `${teamColor}60` },
                { offset: 0.5, color: `${teamColor}20` },
                { offset: 1, color: `${teamColor}05` },
              ],
            },
          },
        },
      ],
      animation: true,
      animationDuration: 1500,
      animationEasing: 'cubicOut',
    };
  };

  if (!driver && !loading && !seasonLoading) {
    return (
      <div className="driver-detail-container">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} className="back-button">
          {TEXT.back}
        </Button>
        <Card>
          <p>{TEXT.unavailable}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="driver-detail-container">
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} className="back-button">
        {TEXT.back}
      </Button>

      <Card loading={seasonLoading || loading}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 36, marginBottom: 8 }}>
            {driver?.givenName} {driver?.familyName}
            {driver?.code ? (
              <span
                style={{
                  marginLeft: 16,
                  display: 'inline-block',
                  padding: '4px 10px',
                  borderRadius: 999,
                  fontSize: 16,
                  background: `${teamColor}20`,
                  color: teamColor,
                }}
              >
                {driver.code}
              </span>
            ) : null}
          </h1>
          <p style={{ fontSize: 18, color: '#666' }}>{driver?.nationality || '-'}</p>
        </div>

        <h3 style={{ fontSize: 20, marginBottom: 16 }}>{currentSeason} {TEXT.seasonKeyStats}</h3>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={8}>
            <Card className="stat-card">
              <div className="stat-label">
                <TrophyOutlined /> {TEXT.seasonRank}
              </div>
              <div className="stat-value" style={{ color: '#faad14' }}>
                {currentStanding?.position || '-'}
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card className="stat-card">
              <div className="stat-label">
                <CarOutlined /> {TEXT.seasonPoints}
              </div>
              <div className="stat-value" style={{ color: '#ff1801' }}>
                {currentStanding?.points || '0'} {TEXT.pointsUnit}
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card className="stat-card">
              <div className="stat-label">
                <TrophyOutlined /> {TEXT.seasonWins}
              </div>
              <div className="stat-value" style={{ color: '#52c41a' }}>
                {currentStanding?.wins || '0'}
              </div>
            </Card>
          </Col>
        </Row>

        <Card
          title={`${currentSeason} ${TEXT.pointsTrend}`}
          style={{ marginBottom: 24, borderRadius: 12, overflow: 'hidden' }}
          headStyle={{
            background: `linear-gradient(135deg, ${teamColor}15 0%, ${teamColor}05 100%)`,
            borderBottom: `2px solid ${teamColor}30`,
            fontSize: 16,
            fontWeight: 600,
          }}
          bodyStyle={{ padding: isMobile ? 0 : 24 }}
        >
          {seasonRaceResults.length > 0 ? (
            <div
              className="chart-scroll-container"
              ref={chartContainerRef}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div
                className="chart-scroll-content"
                style={{
                  width: isMobile ? Math.max(seasonRaceResults.length * 70 * chartScale, window.innerWidth) : '100%',
                  transform: isMobile ? 'scaleX(1)' : 'none',
                  transformOrigin: 'left center',
                }}
              >
                {chartEnabled ? (
                  <Suspense
                    fallback={(
                      <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                        {TEXT.chartLoading}
                      </div>
                    )}
                  >
                    <LazyEChartsPanel
                      chartKey={`${resolvedDriverId || driverId}-${currentSeason}-${seasonRaceResults.length}`}
                      option={getPointsChartOption()}
                      height={chartHeight}
                    />
                  </Suspense>
                ) : (
                  <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                    {TEXT.chartLoading}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>{TEXT.noTrendData}</div>
          )}
        </Card>

        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 20, marginBottom: 6 }}>{TEXT.careerStats}</h3>
          <div style={{ color: '#8c8c8c', fontSize: 13 }}>
            {careerStatsLoading ? TEXT.loadingCareerStats : TEXT.loadedCareerStats}
          </div>
        </div>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12}>
            <Card className="stat-card">
              <div className="stat-label">
                <FlagOutlined /> {TEXT.raceEntries}
              </div>
              <div className="stat-value" style={{ color: '#1890ff' }}>
                {careerStats.raceCount}
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12}>
            <Card className="stat-card">
              <div className="stat-label">
                <TrophyOutlined /> {TEXT.raceWins}
              </div>
              <div className="stat-value" style={{ color: '#fa8c16' }}>
                {careerStats.winCount}
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12}>
            <Card className="stat-card">
              <div className="stat-label">
                <TrophyOutlined /> {TEXT.podiums}
              </div>
              <div className="stat-value" style={{ color: '#722ed1' }}>
                {driver?.totalPodiums || 0}
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12}>
            <Card className="stat-card">
              <div className="stat-label">
                <FlagOutlined /> {TEXT.poles}
              </div>
              <div className="stat-value" style={{ color: '#13c2c2' }}>
                {careerStats.poleCount}
              </div>
            </Card>
          </Col>
        </Row>

        <Card title={TEXT.driverInfo}>
          <Row gutter={[24, 16]}>
            <Col xs={24} sm={12}>
              <p><strong>{TEXT.name}</strong>{driver?.givenName} {driver?.familyName}</p>
              <p><strong>{TEXT.code}</strong>{driver?.code || '-'}</p>
              <p><strong>{TEXT.number}</strong>{driver?.permanentNumber || '-'}</p>
              <p><strong>{TEXT.nationality}</strong>{driver?.nationality || '-'}</p>
            </Col>
            <Col xs={24} sm={12}>
              <p><strong>{TEXT.birthDate}</strong>{driver?.dateOfBirth ? dayjs(driver.dateOfBirth).format('YYYY-MM-DD') : '-'}</p>
              <p><strong>{TEXT.currentTeam}</strong>{currentStanding?.Constructors[0]?.name || '-'}</p>
            </Col>
          </Row>
        </Card>
      </Card>
    </div>
  );
};

export default DriverDetail;
