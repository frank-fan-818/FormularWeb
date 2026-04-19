import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Col, Row } from 'antd';
import { ArrowLeftOutlined, FlagOutlined, TeamOutlined, TrophyOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { constructorApi, seasonApi } from '@/api/ergast';
import { supabaseApi } from '@/api/supabase';
import { useAppStore } from '@/store';
import type { ConstructorStanding } from '@/types';
import { getTeamColor } from '@/utils/teamColors';
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

function mapSupabaseConstructor(constructor: Record<string, any>): ConstructorProfile {
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
  const navigate = useNavigate();
  const { currentSeason } = useAppStore();
  const [constructor, setConstructor] = useState<ConstructorProfile | null>(null);
  const [currentStanding, setCurrentStanding] = useState<ConstructorStanding | null>(null);
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
  const [chartHeight, setChartHeight] = useState(400);
  const [isMobile, setIsMobile] = useState(false);
  const [chartScale, setChartScale] = useState(1);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ distance: number; scale: number } | null>(null);

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
    const loadData = async () => {
      if (!constructorId) {
        return;
      }

      setLoading(true);

      const [
        constructorInfo,
        standings,
        raceCount,
        poleCount,
        winCount,
        championshipCount,
        totalPoints,
        raceResults,
        sprintResults,
      ] = await Promise.allSettled([
        supabaseApi.constructors.getById(constructorId),
        seasonApi.getConstructorStandings(currentSeason),
        constructorApi.getConstructorRaceCount(constructorId),
        constructorApi.getConstructorPoleCount(constructorId),
        constructorApi.getConstructorWinCount(constructorId),
        constructorApi.getConstructorChampionshipCount(constructorId),
        constructorApi.getConstructorTotalPoints(constructorId),
        constructorApi.getConstructorSeasonRaceResults(constructorId, currentSeason),
        seasonApi.getSeasonSprintResults(currentSeason),
      ]);

      let baseConstructor = constructorInfo.status === 'fulfilled' && constructorInfo.value
        ? mapSupabaseConstructor(constructorInfo.value)
        : null;

      if (standings.status === 'fulfilled') {
        const standing = standings.value.find((item) => item.Constructor.constructorId === constructorId) || null;
        setCurrentStanding(standing);

        if (standing) {
          baseConstructor = {
            ...standing.Constructor,
            ...baseConstructor,
            totalWins: baseConstructor?.totalWins ?? 0,
            totalPodiums: baseConstructor?.totalPodiums ?? 0,
            totalPolePositions: baseConstructor?.totalPolePositions ?? 0,
            totalFastestLaps: baseConstructor?.totalFastestLaps ?? 0,
            totalRaceEntries: baseConstructor?.totalRaceEntries ?? 0,
          };
        }
      } else {
        setCurrentStanding(null);
      }

      setConstructor(baseConstructor);

      if (raceResults.status === 'fulfilled') {
        setSeasonRaceResults(
          raceResults.value.sort((left, right) => parseInt(left.round, 10) - parseInt(right.round, 10)),
        );
      } else {
        setSeasonRaceResults([]);
      }

      if (sprintResults.status === 'fulfilled') {
        setSeasonSprintResults(sprintResults.value);
      } else {
        setSeasonSprintResults([]);
      }

      setCareerStats({
        raceCount: raceCount.status === 'fulfilled' ? raceCount.value : (baseConstructor?.totalRaceEntries || 0),
        poleCount: poleCount.status === 'fulfilled' ? poleCount.value : (baseConstructor?.totalPolePositions || 0),
        winCount: winCount.status === 'fulfilled' ? winCount.value : (baseConstructor?.totalWins || 0),
        championshipCount: championshipCount.status === 'fulfilled' ? championshipCount.value : 0,
        totalPoints: totalPoints.status === 'fulfilled' ? totalPoints.value : 0,
      });

      setLoading(false);
    };

    void loadData();
  }, [constructorId, currentSeason]);

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
        sprintRace.SprintResults.forEach((result: any) => {
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
        race.Results.forEach((result: any) => {
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
        formatter: (params: any) => {
          const index = params[0].dataIndex;
          const round = seasonRaceResults[index]?.round;
          const sprintPoints = sprintPointsMap[round] || 0;
          const racePoints = singlePoints[index] - sprintPoints;

          let result = `<div style="font-weight: 600; margin-bottom: 8px; font-size: 14px;">${params[0].name}</div>`;
          result += `<div style="display: flex; justify-content: space-between; gap: 20px; margin-bottom: 4px;"><span>Race points:</span><span style="font-weight: 600;">${racePoints}</span></div>`;
          if (sprintPoints > 0) {
            result += `<div style="display: flex; justify-content: space-between; gap: 20px; margin-bottom: 4px;"><span>Sprint points:</span><span style="font-weight: 600; color: #52c41a;">+${sprintPoints}</span></div>`;
          }
          result += `<div style="display: flex; justify-content: space-between; gap: 20px; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #f0f0f0;"><span>Round total:</span><span style="font-weight: 600;">${singlePoints[index]}</span></div>`;
          result += `<div style="display: flex; justify-content: space-between; gap: 20px; align-items: center;"><span style="display: flex; align-items: center; gap: 6px;"><span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${teamColor};"></span>Cumulative points:</span><span style="font-weight: 700; font-size: 16px; color: ${teamColor};">${params[0].value}</span></div>`;
          return result;
        },
      },
      legend: {
        data: ['Cumulative Points'],
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
        name: 'Cumulative Points',
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
          name: 'Cumulative Points',
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

  if (!constructor && !loading) {
    return (
      <div className="constructor-detail-container">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} className="back-button">
          Back
        </Button>
        <Card>
          <p>Constructor details are unavailable.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="constructor-detail-container">
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} className="back-button">
        Back
      </Button>

      <Card loading={loading}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 36, marginBottom: 8 }}>
            {constructor?.name}
          </h1>
          <p style={{ fontSize: 18, color: '#666' }}>{constructor?.nationality || '-'}</p>
        </div>

        <h3 style={{ fontSize: 20, marginBottom: 16 }}>{currentSeason} Season Stats</h3>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={8}>
            <Card className="stat-card">
              <div className="stat-label">
                <TrophyOutlined /> Season Rank
              </div>
              <div className="stat-value" style={{ color: '#faad14' }}>
                {currentStanding?.position || '-'}
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card className="stat-card">
              <div className="stat-label">
                <TeamOutlined /> Season Points
              </div>
              <div className="stat-value" style={{ color: '#ff1801' }}>
                {currentStanding?.points || '0'} pts
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card className="stat-card">
              <div className="stat-label">
                <TrophyOutlined /> Season Wins
              </div>
              <div className="stat-value" style={{ color: '#52c41a' }}>
                {currentStanding?.wins || '0'}
              </div>
            </Card>
          </Col>
        </Row>

        <Card
          title={`${currentSeason} Season Points Trend`}
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
                <ReactECharts
                  key={`${constructorId}-${currentSeason}-${seasonRaceResults.length}`}
                  option={getPointsChartOption()}
                  style={{ height: chartHeight }}
                  notMerge
                  lazyUpdate
                />
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>No season points data.</div>
          )}
        </Card>

        <h3 style={{ fontSize: 20, marginBottom: 16 }}>Historical Stats</h3>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12}>
            <Card className="stat-card">
              <div className="stat-label">
                <FlagOutlined /> Race Entries
              </div>
              <div className="stat-value" style={{ color: '#1890ff' }}>
                {careerStats.raceCount}
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12}>
            <Card className="stat-card">
              <div className="stat-label">
                <TrophyOutlined /> Race Wins
              </div>
              <div className="stat-value" style={{ color: '#fa8c16' }}>
                {careerStats.winCount}
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12}>
            <Card className="stat-card">
              <div className="stat-label">
                <TrophyOutlined /> Podiums
              </div>
              <div className="stat-value" style={{ color: '#722ed1' }}>
                {constructor?.totalPodiums || 0}
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12}>
            <Card className="stat-card">
              <div className="stat-label">
                <FlagOutlined /> Pole Positions
              </div>
              <div className="stat-value" style={{ color: '#13c2c2' }}>
                {careerStats.poleCount}
              </div>
            </Card>
          </Col>
        </Row>

        <Card title="Constructor Info">
          <Row gutter={[24, 16]}>
            <Col xs={24} sm={12}>
              <p><strong>Name:</strong> {constructor?.name || '-'}</p>
              <p><strong>Nationality:</strong> {constructor?.nationality || '-'}</p>
            </Col>
          </Row>
        </Card>
      </Card>
    </div>
  );
};

export default ConstructorDetail;
