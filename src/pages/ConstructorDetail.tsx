import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Col, Row } from 'antd';
import { ArrowLeftOutlined, FlagOutlined, TeamOutlined, TrophyOutlined } from '@ant-design/icons';
import DocumentHead from '@/components/DocumentHead';
import type { TooltipComponentFormatterCallbackParams } from 'echarts';
import { constructorApi, seasonApi } from '@/api/ergast';
import { historyProfilesApi } from '@/api/historyProfiles';
import { supabaseApi } from '@/api/supabase';
import { useSeasonData } from '@/hooks';
import { useAppStore } from '@/store';
import type {
  HistoryCareerSummary,
  Race,
  Result,
  SupabaseConstructorDetailRow,
} from '@/types';
import { getTeamColor } from '@/utils/teamColors';
import { ConstructorLogo } from '@/utils/constructorLogos';
import ProductSectionHeader from '@/components/product/ProductSectionHeader';
import { escapeHtml, getFirstTooltipParam } from '@/utils/chartTooltip';
import './ConstructorDetail.css';

interface ConstructorProfile {
  constructorId: string;
  url: string;
  name: string;
  nationality: string;
  totalWins: number;
  totalPodiums: number;
  totalPolePositions: number;
  totalFastestLaps: number;
  totalRaceEntries: number;
}

const TEXT = {
  cumulativePoints: '\u7d2f\u8ba1\u79ef\u5206',
  racePoints: '\u6b63\u8d5b\u79ef\u5206',
  sprintPoints: '\u51b2\u523a\u79ef\u5206',
  roundTotal: '\u5355\u7ad9\u603b\u5206',
  back: '\u8fd4\u56de\u8f66\u961f\u5217\u8868',
  unavailable: '\u6682\u65f6\u65e0\u6cd5\u83b7\u53d6\u8be5\u8f66\u961f\u4fe1\u606f\u3002',
  seasonKeyStats: '\u8d5b\u5b63\u5173\u952e\u6570\u636e',
  seasonRank: '\u8d5b\u5b63\u6392\u540d',
  seasonPoints: '\u8d5b\u5b63\u79ef\u5206',
  seasonWins: '\u8d5b\u5b63\u80dc\u573a',
  pointsTrend: '\u8d5b\u5b63\u79ef\u5206\u8d70\u52bf',
  noTrendData: '\u6682\u65e0\u8d5b\u5b63\u79ef\u5206\u8d70\u52bf\u6570\u636e\u3002',
  historicalStats: '\u5386\u53f2\u7edf\u8ba1',
  loadingHistoricalStats: '\u6b63\u5728\u8865\u5145\u5386\u53f2\u7edf\u8ba1...',
  loadedHistoricalStats: '\u5386\u53f2\u7edf\u8ba1\u5df2\u5b8c\u6210\u52a0\u8f7d\u3002',
  raceEntries: '\u53c2\u8d5b\u573a\u6b21',
  raceWins: '\u5206\u7ad9\u51a0\u519b',
  podiums: '\u767b\u4e0a\u9886\u5956\u53f0',
  poles: '\u6746\u4f4d\u6b21\u6570',
  constructorInfo: '\u8f66\u961f\u4fe1\u606f',
  name: '\u540d\u79f0\uff1a',
  nationality: '\u56fd\u7c4d\uff1a',
  pointsUnit: '\u5206',
  chartLoading: '\u6b63\u5728\u52a0\u8f7d\u56fe\u8868...',
};

const LazyEChartsPanel = lazy(() => import('@/components/charts/EChartsPanel'));
const EMPTY_CAREER_STATS: HistoryCareerSummary = {
  raceCount: 0,
  poleCount: 0,
  winCount: 0,
  podiumCount: 0,
  championshipCount: 0,
  totalPoints: 0,
};

function mapSupabaseConstructor(constructor: SupabaseConstructorDetailRow): ConstructorProfile {
  return {
    constructorId: constructor.constructor_id,
    url: '#',
    name: constructor.name || '',
    nationality: constructor.nationality || '',
    totalWins: constructor.total_wins || 0,
    totalPodiums: constructor.total_podiums || 0,
    totalPolePositions: constructor.total_pole_positions || 0,
    totalFastestLaps: constructor.total_fastest_laps || 0,
    totalRaceEntries: constructor.total_race_entries || 0,
  };
}

const ConstructorDetail = () => {
  const { constructorId } = useParams<{ constructorId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentSeason } = useAppStore();
  const { constructorStandings, loading: seasonLoading } = useSeasonData(currentSeason);
  const showHistoryOverview = location.pathname.startsWith('/history/constructors/');

  const [constructor, setConstructor] = useState<ConstructorProfile | null>(null);
  const [careerStats, setCareerStats] = useState<HistoryCareerSummary>(EMPTY_CAREER_STATS);
  const [seasonRaceResults, setSeasonRaceResults] = useState<Race[]>([]);
  const [seasonSprintResults, setSeasonSprintResults] = useState<Race[]>([]);
  const [loading, setLoading] = useState(false);
  const [seasonResultsLoading, setSeasonResultsLoading] = useState(false);
  const [careerStatsLoading, setCareerStatsLoading] = useState(false);
  const [chartHeight, setChartHeight] = useState(400);
  const [isMobile, setIsMobile] = useState(false);
  const [chartScale, setChartScale] = useState(1);
  const [chartEnabled, setChartEnabled] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ distance: number; scale: number } | null>(null);

  const currentStanding = constructorStandings.find((item) => item.Constructor.constructorId === constructorId) || null;

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
    if (!constructorId || seasonLoading) {
      return;
    }

    let cancelled = false;

    setLoading(true);
    setSeasonResultsLoading(true);
    setCareerStatsLoading(false);
    setSeasonRaceResults([]);
    setSeasonSprintResults([]);

    if (currentStanding) {
      setConstructor({
        ...currentStanding.Constructor,
        totalWins: 0,
        totalPodiums: 0,
        totalPolePositions: 0,
        totalFastestLaps: 0,
        totalRaceEntries: 0,
      });
    } else {
      setConstructor(null);
    }

    const loadPrimaryData = async () => {
      const constructorInfo = await Promise.allSettled([
        supabaseApi.constructors.getById(constructorId),
      ]);

      if (cancelled) {
        return;
      }

      let baseConstructor = constructorInfo[0].status === 'fulfilled' && constructorInfo[0].value
        ? mapSupabaseConstructor(constructorInfo[0].value)
        : null;

      if (currentStanding) {
        baseConstructor = {
          ...currentStanding.Constructor,
          ...baseConstructor,
          nationality: baseConstructor?.nationality || currentStanding.Constructor.nationality || '',
          totalWins: baseConstructor?.totalWins ?? 0,
          totalPodiums: baseConstructor?.totalPodiums ?? 0,
          totalPolePositions: baseConstructor?.totalPolePositions ?? 0,
          totalFastestLaps: baseConstructor?.totalFastestLaps ?? 0,
          totalRaceEntries: baseConstructor?.totalRaceEntries ?? 0,
        };
      }

      setConstructor(baseConstructor);
      setLoading(false);

      const [raceResults, sprintResults] = await Promise.allSettled([
        constructorApi.getConstructorSeasonRaceResults(constructorId, currentSeason),
        seasonApi.getSeasonSprintResults(currentSeason),
      ]);

      if (!cancelled) {
        if (raceResults.status === 'fulfilled') {
          setSeasonRaceResults(
            raceResults.value.sort(
              (left, right) => parseInt(left.round, 10) - parseInt(right.round, 10),
            ),
          );
        } else {
          setSeasonRaceResults([]);
        }

        setSeasonSprintResults(
          sprintResults.status === 'fulfilled' ? sprintResults.value : [],
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
  }, [constructorId, currentSeason, currentStanding, seasonLoading]);

  useEffect(() => {
    if (!constructorId || !showHistoryOverview) {
      setCareerStats(EMPTY_CAREER_STATS);
      setCareerStatsLoading(false);
      return;
    }

    let cancelled = false;

    setCareerStats(EMPTY_CAREER_STATS);
    setCareerStatsLoading(true);

    const loadCareerStats = async () => {
      const profile = await historyProfilesApi.getConstructorHistoryProfile(constructorId);

      if (cancelled) {
        return;
      }

      if (profile) {
        setCareerStats(profile.careerSummary);
      }

      setCareerStatsLoading(false);
    };

    void loadCareerStats().catch(() => {
      if (!cancelled) {
        setCareerStatsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [constructorId, showHistoryOverview]);

  const teamColor = constructorId ? getTeamColor(constructorId) : '#1890ff';

  const getPointsChartOption = () => {
    let cumulativePoints = 0;
    const raceNames: string[] = [];
    const singlePoints: number[] = [];
    const cumulativePointsArr: number[] = [];
    const totalPoints = currentStanding ? parseFloat(currentStanding.points) : 0;

    const sprintPointsMap: Record<string, number> = {};
    seasonSprintResults.forEach((sprintRace) => {
      if (sprintRace.SprintResults && sprintRace.SprintResults.length > 0) {
        let sprintPoints = 0;
        sprintRace.SprintResults.forEach((result: Result) => {
          if (result.Constructor.constructorId === constructorId) {
            sprintPoints += parseFloat(result.points);
          }
        });
        if (sprintPoints > 0) {
          sprintPointsMap[sprintRace.round] = sprintPoints;
        }
      }
    });

    seasonRaceResults.forEach((race) => {
      raceNames.push(race.raceName.replace(' Grand Prix', ''));
      let raceTotalPoints = 0;

      if (race.Results && race.Results.length > 0) {
        race.Results.forEach((result: Result) => {
          if (result.Constructor.constructorId === constructorId) {
            raceTotalPoints += parseFloat(result.points);
          }
        });
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
        formatter: (params: TooltipComponentFormatterCallbackParams) => {
          const firstParam = getFirstTooltipParam(params);
          if (!firstParam) return '';
          const index = firstParam.dataIndex;
          const round = seasonRaceResults[index]?.round;
          const sprintPoints = sprintPointsMap[round] || 0;
          const racePoints = singlePoints[index] - sprintPoints;

          let result = `<div style="font-weight: 600; margin-bottom: 8px; font-size: 14px;">${escapeHtml(firstParam.name)}</div>`;
          result += `<div style="display: flex; justify-content: space-between; gap: 20px; margin-bottom: 4px;"><span>${TEXT.racePoints}:</span><span style="font-weight: 600;">${racePoints}</span></div>`;
          if (sprintPoints > 0) {
            result += `<div style="display: flex; justify-content: space-between; gap: 20px; margin-bottom: 4px;"><span>${TEXT.sprintPoints}:</span><span style="font-weight: 600; color: #52c41a;">+${sprintPoints}</span></div>`;
          }
          result += `<div style="display: flex; justify-content: space-between; gap: 20px; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #f0f0f0;"><span>${TEXT.roundTotal}:</span><span style="font-weight: 600;">${singlePoints[index]}</span></div>`;
          result += `<div style="display: flex; justify-content: space-between; gap: 20px; align-items: center;"><span style="display: flex; align-items: center; gap: 6px;"><span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${teamColor};"></span>${TEXT.cumulativePoints}:</span><span style="font-weight: 700; font-size: 16px; color: ${teamColor};">${escapeHtml(firstParam.value)}</span></div>`;
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

  if (!constructor && !loading && !seasonLoading) {
    return (
      <div className="constructor-detail-container">
        <DocumentHead title="车队详情 — F1 Dashboard" description="F1车队详情，赛季数据、历史统计和积分走势" />
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
    <div className="constructor-detail-container">
      <DocumentHead
        title={constructor?.name ? `${constructor.name} — F1 Dashboard` : '车队详情 — F1 Dashboard'}
        description={`${constructor?.name || ''} F1车队详情，赛季数据、历史统计和积分走势`}
      />
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} className="back-button">
        {TEXT.back}
      </Button>

      <Card loading={!constructor && (seasonLoading || loading)} className="constructor-profile-shell">
        <section className="constructor-profile-hero" style={{ borderTopColor: teamColor }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
            <ConstructorLogo constructorId={constructorId || ''} size={96} />
            <div className="constructor-profile-copy">
              <div className="constructor-profile-kicker">
                <span className="constructor-profile-swatch" style={{ backgroundColor: teamColor }} />
                <span>{constructor?.nationality || '-'}</span>
              </div>
              <h1 className="constructor-profile-name">{constructor?.name || '-'}</h1>
              <div className="constructor-profile-tags">
                <span>{currentSeason}</span>
                <span>{TEXT.seasonKeyStats}</span>
              </div>
            </div>
          </div>
          <div className="constructor-profile-rank" style={{ color: teamColor }}>
            {currentStanding?.position ? `P${currentStanding.position}` : '--'}
          </div>
        </section>

        <div className="constructor-current-stat-grid">
          <Card className="constructor-current-stat-card">
            <div className="stat-label">
              <TrophyOutlined /> {TEXT.seasonRank}
            </div>
            <div className="stat-value" style={{ color: teamColor }}>
              {currentStanding?.position ? `P${currentStanding.position}` : '-'}
            </div>
          </Card>
          <Card className="constructor-current-stat-card">
            <div className="stat-label">
              <TeamOutlined /> {TEXT.seasonPoints}
            </div>
            <div className="stat-value">
              {currentStanding?.points || '0'} {TEXT.pointsUnit}
            </div>
          </Card>
          <Card className="constructor-current-stat-card">
            <div className="stat-label">
              <TrophyOutlined /> {TEXT.seasonWins}
            </div>
            <div className="stat-value">
              {currentStanding?.wins || '0'}
            </div>
          </Card>
        </div>

        <ProductSectionHeader
          index="01"
          eyebrow={`${currentSeason} / TEAM FORM`}
          title={TEXT.pointsTrend}
        />
        <Card
          title={`${currentSeason} ${TEXT.pointsTrend}`}
          style={{ marginBottom: 24, borderRadius: 12, overflow: 'hidden' }}
          styles={{
            header: {
              background: `linear-gradient(135deg, ${teamColor}15 0%, ${teamColor}05 100%)`,
              borderBottom: `2px solid ${teamColor}30`,
              fontSize: 16,
              fontWeight: 600,
            },
            body: { padding: isMobile ? 0 : 24 },
          }}
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
                      chartKey={`${constructorId}-${currentSeason}-${seasonRaceResults.length}`}
                      option={getPointsChartOption()}
                      height={chartHeight}
                      ariaLabel="车队本赛季各分站积分与累计积分趋势图。"
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
              <h3 style={{ fontSize: 20, marginBottom: 6 }}>{TEXT.historicalStats}</h3>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
                {careerStatsLoading ? TEXT.loadingHistoricalStats : TEXT.loadedHistoricalStats}
              </div>
            </div>
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col xs={24} sm={12}>
                <Card className="stat-card">
                  <div className="stat-label">
                    <FlagOutlined /> {TEXT.raceEntries}
                  </div>
                  <div className="stat-value" style={{ color: teamColor }}>
                    {careerStats.raceCount}
                  </div>
                </Card>
              </Col>
              <Col xs={24} sm={12}>
                <Card className="stat-card">
                  <div className="stat-label">
                    <TrophyOutlined /> {TEXT.raceWins}
                  </div>
                  <div className="stat-value" style={{ color: 'var(--accent-gold)' }}>
                    {careerStats.winCount}
                  </div>
                </Card>
              </Col>
              <Col xs={24} sm={12}>
                <Card className="stat-card">
                  <div className="stat-label">
                    <TrophyOutlined /> {TEXT.podiums}
                  </div>
                  <div className="stat-value" style={{ color: 'var(--accent-bronze)' }}>
                    {careerStats.podiumCount}
                  </div>
                </Card>
              </Col>
              <Col xs={24} sm={12}>
                <Card className="stat-card">
                  <div className="stat-label">
                    <FlagOutlined /> {TEXT.poles}
                  </div>
                  <div className="stat-value" style={{ color: 'var(--race-control-apex)' }}>
                    {careerStats.poleCount}
                  </div>
                </Card>
              </Col>
            </Row>
          </>
        ) : null}

        <Card title={TEXT.constructorInfo}>
          <Row gutter={[24, 16]}>
            <Col xs={24} sm={12}>
              <p><strong>{TEXT.name}</strong>{constructor?.name || '-'}</p>
              <p><strong>{TEXT.nationality}</strong>{constructor?.nationality || '-'}</p>
            </Col>
          </Row>
        </Card>
      </Card>
    </div>
  );
};

export default ConstructorDetail;
