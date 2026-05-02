import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Col, Empty, Row, Tag } from 'antd';
import { ArrowLeftOutlined, CarOutlined, FlagOutlined, TrophyOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { driverApi, seasonApi } from '@/api/ergast';
import { historyProfilesApi } from '@/api/historyProfiles';
import { supabaseApi } from '@/api/supabase';
import { useSeasonData } from '@/hooks';
import { useAppStore } from '@/store';
import type { BestFinishSummary, DriverHistoryProfile, DriverStanding } from '@/types';
import { canCountChampionshipSeason, getCountableChampionshipSeasons } from '@/utils/championship';
import { isSeasonComplete } from '@/utils/seasonCompletion';
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
  careerStats: '\u5386\u53f2\u751f\u6daf\u6982\u89c8',
  loadingCareerStats: '\u6b63\u5728\u52a0\u8f7d\u5386\u53f2 summary...',
  loadedCareerStats: '\u5386\u53f2 summary \u5df2\u52a0\u8f7d\u3002',
  historyUnavailable: '\u6682\u672a\u83b7\u53d6\u5230\u5386\u53f2\u8d5b\u5b63\u6863\u6848\u3002',
  raceEntries: '\u53c2\u8d5b\u573a\u6b21',
  raceWins: '\u5206\u7ad9\u51a0\u519b',
  podiums: '\u9886\u5956\u53f0',
  poles: '\u6746\u4f4d\u6b21\u6570',
  championships: '\u4e16\u754c\u51a0\u519b',
  totalPoints: '\u603b\u79ef\u5206',
  driverInfo: '\u8f66\u624b\u4fe1\u606f',
  name: '\u59d3\u540d\uff1a',
  code: '\u7b80\u79f0\uff1a',
  number: '\u53f7\u7801\uff1a',
  nationality: '\u56fd\u7c4d\uff1a',
  birthDate: '\u51fa\u751f\u65e5\u671f\uff1a',
  currentTeam: '\u5f53\u524d\u8f66\u961f\uff1a',
  recentTeam: '\u6700\u8fd1\u6548\u529b\u8f66\u961f\uff1a',
  firstSeason: '\u9996\u4e2a\u8d5b\u5b63',
  latestSeason: '\u6700\u65b0\u8d5b\u5b63',
  bestRaceFinish: '\u6700\u4f73\u5206\u7ad9\u6210\u7ee9',
  championshipSeasons: '\u51a0\u519b\u8d5b\u5b63',
  seasonTimeline: '\u8d5b\u5b63\u65f6\u95f4\u7ebf',
  seasonHistoryUnavailable: '\u6682\u65e0\u5386\u53f2\u8d5b\u5b63\u6570\u636e\u3002',
  season: '\u8d5b\u5b63',
  team: '\u8f66\u961f',
  rank: '\u6392\u540d',
  wins: '\u80dc\u573a',
  highlights: '\u6807\u8bb0',
  champion: '\u51a0\u519b',
  latest: '\u6700\u65b0',
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

function formatPoints(points: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(points);
}

function formatBestFinish(summary: BestFinishSummary | null | undefined): string {
  if (!summary) {
    return '-';
  }

  if (summary.seasons.length === 1) {
    return `P${summary.position} - ${summary.seasons[0]}`;
  }

  return `P${summary.position} - ${summary.seasons.length} seasons`;
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
  const location = useLocation();
  const navigate = useNavigate();
  const { currentSeason } = useAppStore();
  const { driverStandings, races: currentSeasonRaces, loading: seasonLoading } = useSeasonData(currentSeason);
  const showHistoryOverview = location.pathname.startsWith('/history/drivers/');

  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [driverHistory, setDriverHistory] = useState<DriverHistoryProfile | null>(null);
  const [seasonRaceResults, setSeasonRaceResults] = useState<any[]>([]);
  const [seasonSprintResults, setSeasonSprintResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [seasonResultsLoading, setSeasonResultsLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [chartHeight, setChartHeight] = useState(400);
  const [isMobile, setIsMobile] = useState(false);
  const [chartScale, setChartScale] = useState(1);
  const [chartEnabled, setChartEnabled] = useState(false);
  const [resolvedDriverId, setResolvedDriverId] = useState<string | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ distance: number; scale: number } | null>(null);

  const currentStanding = driverId ? findStandingByDriverId(driverStandings, driverId) : null;
  const historySeasons = driverHistory?.seasons || [];
  const firstSeason = historySeasons.length > 0 ? historySeasons[historySeasons.length - 1] : null;
  const latestSeason = historySeasons[0] || null;
  const latestSeasonCanBeChampion = latestSeason?.season === currentSeason ? isSeasonComplete(currentSeasonRaces) : true;
  const championshipSeasons = getCountableChampionshipSeasons(historySeasons, latestSeason, latestSeasonCanBeChampion);
  const teamColor = currentStanding?.Constructors[0]?.constructorId
    ? getTeamColor(currentStanding.Constructors[0].constructorId)
    : (driverHistory?.recentConstructorId ? getTeamColor(driverHistory.recentConstructorId) : '#1890ff');

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
    setSeasonResultsLoading(true);
    setResolvedDriverId(null);
    setSeasonRaceResults([]);
    setSeasonSprintResults([]);

    if (currentStanding) {
      setDriver({
        ...currentStanding.Driver,
        totalWins: 0,
        totalPodiums: 0,
        totalPolePositions: 0,
        totalFastestLaps: 0,
        totalRaceStarts: 0,
      });
    } else {
      setDriver(null);
    }

    const loadPrimaryData = async () => {
      const [baseDriverResult, resolvedDriverIdResult] = await Promise.allSettled([
        resolveSupabaseDriverProfile(driverId, currentStanding),
        resolveErgastDriverId(driverId, currentSeason, currentStanding),
      ]);

      if (cancelled) {
        return;
      }

      const baseDriver = baseDriverResult.status === 'fulfilled' ? baseDriverResult.value : null;
      const nextResolvedDriverId = resolvedDriverIdResult.status === 'fulfilled'
        ? resolvedDriverIdResult.value
        : driverId;

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
      setLoading(false);

      const [raceResultsResult, sprintResultsResult] = await Promise.allSettled([
        driverApi.getDriverSeasonRaceResults(nextResolvedDriverId, currentSeason),
        seasonApi.getSeasonSprintResults(currentSeason),
      ]);

      if (!cancelled) {
        if (raceResultsResult.status === 'fulfilled') {
          setSeasonRaceResults(
            raceResultsResult.value.sort(
              (left, right) => parseInt(left.round, 10) - parseInt(right.round, 10),
            ),
          );
        } else {
          setSeasonRaceResults([]);
        }

        setSeasonSprintResults(
          sprintResultsResult.status === 'fulfilled' ? sprintResultsResult.value : [],
        );
        setSeasonResultsLoading(false);
      }
    };

    void loadPrimaryData().catch(() => {
      if (!cancelled) {
        setLoading(false);
        setSeasonResultsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [currentSeason, currentStanding, driverId, seasonLoading]);

  useEffect(() => {
    if (!driverId || !showHistoryOverview) {
      setDriverHistory(null);
      setHistoryLoading(false);
      return;
    }

    let cancelled = false;
    setHistoryLoading(true);

    const loadHistorySummary = async () => {
      try {
        const profile = await historyProfilesApi.getDriverHistoryProfile(driverId);
        if (!cancelled) {
          setDriverHistory(profile);
        }
      } catch {
        if (!cancelled) {
          setDriverHistory(null);
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      }
    };

    void loadHistorySummary();

    return () => {
      cancelled = true;
    };
  }, [driverId, showHistoryOverview]);

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

      <Card loading={!driver && (seasonLoading || loading)} className="driver-profile-shell">
        <section className="driver-profile-hero" style={{ borderTopColor: teamColor }}>
          <div className="driver-profile-copy">
            <div className="driver-profile-kicker">
              <span className="driver-profile-swatch" style={{ backgroundColor: teamColor }} />
              <span>{currentStanding?.Constructors[0]?.name || driverHistory?.recentConstructorName || '-'}</span>
            </div>
            <h1 className="driver-profile-name">
              <span>{driver?.givenName || '-'}</span>
              <strong>{driver?.familyName || ''}</strong>
            </h1>
            <div className="driver-profile-tags">
              {driver?.code ? <Tag color="default">{driver.code}</Tag> : null}
              <Tag color="default">{driver?.nationality || '-'}</Tag>
              <Tag color="default">{currentSeason}</Tag>
            </div>
          </div>
          <div className="driver-profile-number" style={{ color: teamColor }}>
            {driver?.permanentNumber || driver?.code || '--'}
          </div>
        </section>

        <div className="driver-current-stat-grid">
          <Card className="driver-current-stat-card">
            <div className="stat-label">
              <TrophyOutlined /> {TEXT.seasonRank}
            </div>
            <div className="stat-value" style={{ color: teamColor }}>
              {currentStanding?.position ? `P${currentStanding.position}` : '-'}
            </div>
          </Card>
          <Card className="driver-current-stat-card">
            <div className="stat-label">
              <CarOutlined /> {TEXT.seasonPoints}
            </div>
            <div className="stat-value">
              {currentStanding?.points || '0'} {TEXT.pointsUnit}
            </div>
          </Card>
          <Card className="driver-current-stat-card">
            <div className="stat-label">
              <TrophyOutlined /> {TEXT.seasonWins}
            </div>
            <div className="stat-value">
              {currentStanding?.wins || '0'}
            </div>
          </Card>
        </div>

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
          ) : seasonResultsLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
              {TEXT.chartLoading}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>{TEXT.noTrendData}</div>
          )}
        </Card>

        {showHistoryOverview ? (
          <>
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 20, marginBottom: 6 }}>{TEXT.careerStats}</h3>
              <div className="history-inline-note">
                {historyLoading ? TEXT.loadingCareerStats : TEXT.loadedCareerStats}
              </div>
            </div>
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col xs={24} sm={8}>
                <Card className="stat-card">
                  <div className="stat-label">
                    <FlagOutlined /> {TEXT.raceEntries}
                  </div>
                  <div className="stat-value" style={{ color: '#1890ff' }}>
                    {driverHistory?.careerSummary.raceCount ?? driver?.totalRaceStarts ?? 0}
                  </div>
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card className="stat-card">
                  <div className="stat-label">
                    <TrophyOutlined /> {TEXT.raceWins}
                  </div>
                  <div className="stat-value" style={{ color: '#fa8c16' }}>
                    {driverHistory?.careerSummary.winCount ?? driver?.totalWins ?? 0}
                  </div>
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card className="stat-card">
                  <div className="stat-label">
                    <TrophyOutlined /> {TEXT.podiums}
                  </div>
                  <div className="stat-value" style={{ color: '#722ed1' }}>
                    {driverHistory?.careerSummary.podiumCount ?? driver?.totalPodiums ?? 0}
                  </div>
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card className="stat-card">
                  <div className="stat-label">
                    <FlagOutlined /> {TEXT.poles}
                  </div>
                  <div className="stat-value" style={{ color: '#13c2c2' }}>
                    {driverHistory?.careerSummary.poleCount ?? driver?.totalPolePositions ?? 0}
                  </div>
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card className="stat-card">
                  <div className="stat-label">
                    <TrophyOutlined /> {TEXT.championships}
                  </div>
                  <div className="stat-value" style={{ color: '#faad14' }}>
                    {driverHistory ? championshipSeasons.length : 0}
                  </div>
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card className="stat-card">
                  <div className="stat-label">
                    <CarOutlined /> {TEXT.totalPoints}
                  </div>
                  <div className="stat-value" style={{ color: '#ff1801' }}>
                    {formatPoints(driverHistory?.careerSummary.totalPoints ?? 0)}
                  </div>
                </Card>
              </Col>
            </Row>

            {driverHistory ? (
              <>
                <div className="driver-history-meta-grid">
                  <Card className="driver-history-meta-card">
                    <div className="driver-history-meta-label">{TEXT.firstSeason}</div>
                    <div className="driver-history-meta-value">{firstSeason?.season || '-'}</div>
                  </Card>
                  <Card className="driver-history-meta-card">
                    <div className="driver-history-meta-label">{TEXT.latestSeason}</div>
                    <div className="driver-history-meta-value">{latestSeason?.season || '-'}</div>
                  </Card>
                  <Card className="driver-history-meta-card">
                    <div className="driver-history-meta-label">{TEXT.bestRaceFinish}</div>
                    <div className="driver-history-meta-value">{formatBestFinish(driverHistory.bestRaceFinish)}</div>
                  </Card>
                  <Card className="driver-history-meta-card">
                    <div className="driver-history-meta-label">{TEXT.championshipSeasons}</div>
                    <div className="driver-history-meta-value">
                      {championshipSeasons.length > 0
                        ? championshipSeasons.map((season) => season.season).join(', ')
                        : '-'}
                    </div>
                  </Card>
                </div>

                <Card title={TEXT.seasonTimeline} className="driver-history-table-card">
                  {historySeasons.length === 0 ? (
                    <Empty description={TEXT.seasonHistoryUnavailable} />
                  ) : (
                    <div className="driver-history-table-wrapper">
                      <table className="driver-history-table">
                        <thead>
                          <tr>
                            <th>{TEXT.season}</th>
                            <th>{TEXT.team}</th>
                            <th>{TEXT.rank}</th>
                            <th>{TEXT.totalPoints}</th>
                            <th>{TEXT.wins}</th>
                            <th>{TEXT.highlights}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {historySeasons.map((season) => {
                            const isChampion = canCountChampionshipSeason(season, latestSeason, latestSeasonCanBeChampion);
                            const isLatest = season.season === latestSeason?.season;
                            const swatchColor = season.constructorId ? getTeamColor(season.constructorId) : teamColor;

                            return (
                              <tr key={`${season.season}-${season.constructorId}`} className={isChampion ? 'driver-history-row-highlight' : ''}>
                                <td>{season.season}</td>
                                <td>
                                  <span className="driver-history-team-cell">
                                    <span className="driver-history-team-swatch" style={{ backgroundColor: swatchColor }} />
                                    <span>{season.constructorName || '-'}</span>
                                  </span>
                                </td>
                                <td>{season.position ? `P${season.position}` : '-'}</td>
                                <td>{formatPoints(season.points)}</td>
                                <td>{season.wins}</td>
                                <td>
                                  <span className="driver-history-table-tags">
                                    {isChampion ? <Tag color="gold">{TEXT.champion}</Tag> : null}
                                    {isLatest ? <Tag color="blue">{TEXT.latest}</Tag> : null}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </>
            ) : (
              !historyLoading ? (
                <Card style={{ marginBottom: 24 }}>
                  <Empty description={TEXT.historyUnavailable} />
                </Card>
              ) : null
            )}
          </>
        ) : null}

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
              <p><strong>{TEXT.currentTeam}</strong>{currentStanding?.Constructors[0]?.name || driverHistory?.recentConstructorName || '-'}</p>
              {driverHistory?.recentConstructorName ? (
                <p><strong>{TEXT.recentTeam}</strong>{driverHistory.recentConstructorName}</p>
              ) : null}
            </Col>
          </Row>
        </Card>
      </Card>
    </div>
  );
};

export default DriverDetail;
