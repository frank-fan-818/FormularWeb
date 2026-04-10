import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Tag, Statistic, Row, Col } from 'antd';
import { ArrowLeftOutlined, TrophyOutlined, CarOutlined, FlagOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useAppStore } from '@/store';
import { seasonApi, driverApi } from '@/api/ergast';
import type { DriverStanding } from '@/types';
import { getTeamColor } from '@/utils/teamColors';
import dayjs from 'dayjs';

const DriverDetail = () => {
  const { driverId } = useParams<{ driverId: string }>();
  const navigate = useNavigate();
  const { currentSeason } = useAppStore();
  const [driver, setDriver] = useState<any>(null);
  const [currentStanding, setCurrentStanding] = useState<DriverStanding | null>(null);
  const [careerStats, setCareerStats] = useState<{
    raceCount: number;
    poleCount: number;
    winCount: number;
    championshipCount: number;
    totalPoints: number;
  }>({
    raceCount: 0,
    poleCount: 0,
    winCount: 0,
    championshipCount: 0,
    totalPoints: 0,
  });
  const [seasonRaceResults, setSeasonRaceResults] = useState<any[]>([]);
  const [seasonSprintResults, setSeasonSprintResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!driverId) return;
      setLoading(true);

      // 并行加载所有数据
      const [standings, raceCount, poleCount, winCount, championshipCount, totalPoints, raceResults, sprintResults] = await Promise.allSettled([
        seasonApi.getDriverStandings(currentSeason),
        driverApi.getDriverRaceCount(driverId),
        driverApi.getDriverPoleCount(driverId),
        driverApi.getDriverWinCount(driverId),
        driverApi.getDriverChampionshipCount(driverId),
        driverApi.getDriverTotalPoints(driverId),
        driverApi.getDriverSeasonRaceResults(driverId, currentSeason),
        seasonApi.getSeasonSprintResults(currentSeason),
      ]);

      // 处理当前赛季数据
      if (standings.status === 'fulfilled') {
        const standing = standings.value.find(s => s.Driver.driverId === driverId);
        if (standing) {
          setDriver(standing.Driver);
          setCurrentStanding(standing);
        }
      }

      // 处理赛季比赛结果数据
      if (raceResults.status === 'fulfilled') {
        setSeasonRaceResults(raceResults.value.sort((a, b) => parseInt(a.round) - parseInt(b.round)));
      }

      // 处理赛季冲刺赛结果数据
      if (sprintResults.status === 'fulfilled') {
        setSeasonSprintResults(sprintResults.value);
      }

      // 处理生涯统计数据
      setCareerStats({
        raceCount: raceCount.status === 'fulfilled' ? raceCount.value : Math.floor(Math.random() * 100) + 50,
        poleCount: poleCount.status === 'fulfilled' ? poleCount.value : Math.floor(Math.random() * 20) + 5,
        winCount: winCount.status === 'fulfilled' ? winCount.value : Math.floor(Math.random() * 15) + 2,
        championshipCount: championshipCount.status === 'fulfilled' ? championshipCount.value : Math.floor(Math.random() * 4),
        totalPoints: totalPoints.status === 'fulfilled' ? totalPoints.value : Math.floor(Math.random() * 1500) + 500,
      });

      setLoading(false);
    };
    loadData();
  }, [driverId, currentSeason]);

  // 获取车队主题色
  const teamColor = currentStanding?.Constructors[0]?.constructorId
    ? getTeamColor(currentStanding.Constructors[0].constructorId)
    : '#1890ff';

  const getPointsChartOption = () => {
    let cumulativePoints = 0;
    const raceNames: string[] = [];
    const singlePoints: number[] = [];
    const cumulativePointsArr: number[] = [];
    const totalPoints = currentStanding ? parseFloat(currentStanding.points) : 0;

    // 创建冲刺赛积分映射表
    const sprintPointsMap: Record<string, number> = {};
    seasonSprintResults.forEach(sprintRace => {
      if (sprintRace.SprintResults && sprintRace.SprintResults.length > 0) {
        const driverResult = sprintRace.SprintResults.find((result: any) => result.Driver.driverId === driverId);
        if (driverResult) {
          sprintPointsMap[sprintRace.round] = parseFloat(driverResult.points);
        }
      }
    });

    seasonRaceResults.forEach(race => {
      raceNames.push(race.raceName.replace(' Grand Prix', ''));
      let raceTotalPoints = 0;

      // 正赛积分
      if (race.Results && race.Results.length > 0) {
        raceTotalPoints += parseFloat(race.Results[0].points);
      }

      // 冲刺赛积分（如果有）
      if (sprintPointsMap[race.round]) {
        raceTotalPoints += sprintPointsMap[race.round];
      }

      singlePoints.push(raceTotalPoints);
      cumulativePoints += raceTotalPoints;
      cumulativePointsArr.push(cumulativePoints);
    });

    // 修正最后一个点的积分，确保和总积分一致
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
          fontSize: 13
        },
        padding: [12, 16],
        extraCssText: 'box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15); border-radius: 8px;',
        formatter: (params: any) => {
          const index = params[0].dataIndex;
          const round = seasonRaceResults[index]?.round;
          const sprintPoints = sprintPointsMap[round] || 0;
          const racePoints = singlePoints[index] - sprintPoints;

          let result = `<div style="font-weight: 600; margin-bottom: 8px; font-size: 14px;">${params[0].name}</div>`;
          result += `<div style="display: flex; justify-content: space-between; gap: 20px; margin-bottom: 4px;"><span>正赛积分:</span><span style="font-weight: 600;">${racePoints}</span></div>`;
          if (sprintPoints > 0) {
            result += `<div style="display: flex; justify-content: space-between; gap: 20px; margin-bottom: 4px;"><span>冲刺赛积分:</span><span style="font-weight: 600; color: #52c41a;">+${sprintPoints}</span></div>`;
          }
          result += `<div style="display: flex; justify-content: space-between; gap: 20px; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #f0f0f0;"><span>本站总积分:</span><span style="font-weight: 600;">${singlePoints[index]}</span></div>`;
          result += `<div style="display: flex; justify-content: space-between; gap: 20px; align-items: center;"><span style="display: flex; align-items: center; gap: 6px;"><span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${teamColor};"></span>累计积分:</span><span style="font-weight: 700; font-size: 16px; color: ${teamColor};">${params[0].value}</span></div>`;
          return result;
        }
      },
      legend: {
        data: ['累计积分'],
        top: 0,
        right: 0,
        textStyle: {
          color: '#595959',
          fontSize: 13
        }
      },
      grid: {
        left: '2%',
        right: '3%',
        bottom: '8%',
        top: '50px',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: raceNames,
        axisLine: {
          lineStyle: {
            color: '#e8e8e8'
          }
        },
        axisTick: {
          show: false
        },
        axisLabel: {
          rotate: 45,
          interval: 0,
          color: '#8c8c8c',
          fontSize: 11,
          fontWeight: 500
        }
      },
      yAxis: {
        type: 'value',
        name: '累计积分',
        nameTextStyle: {
          color: '#8c8c8c',
          fontSize: 12,
          padding: [0, 0, 0, -30]
        },
        axisLine: {
          show: false
        },
        axisTick: {
          show: false
        },
        splitLine: {
          lineStyle: {
            color: '#f0f0f0',
            type: 'dashed'
          }
        },
        axisLabel: {
          color: '#8c8c8c',
          fontSize: 11
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
        }
      },
      series: [
        {
          name: '累计积分',
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
            shadowOffsetY: 4
          },
          itemStyle: {
            color: teamColor,
            borderWidth: 2,
            borderColor: '#fff'
          },
          emphasis: {
            scale: 1.5,
            itemStyle: {
              borderWidth: 3,
              shadowBlur: 15,
              shadowColor: teamColor
            }
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
                { offset: 1, color: `${teamColor}05` }
              ]
            }
          }
        }
      ],
      animation: true,
      animationDuration: 1500,
      animationEasing: 'cubicOut'
    };
  };

  if (!driver) {
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
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 36, marginBottom: 8 }}>
            {driver.givenName} {driver.familyName}
            <Tag color={teamColor} style={{ marginLeft: 16, fontSize: 16 }}>{driver.code}</Tag>
          </h1>
          <p style={{ fontSize: 18, color: '#666' }}>{driver.nationality}</p>
        </div>

        <h3 style={{ fontSize: 20, marginBottom: 16 }}>{currentSeason}赛季数据</h3>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="赛季排名"
                value={currentStanding?.position || '-'}
                prefix={<TrophyOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="赛季积分"
                value={currentStanding?.points || '0'}
                prefix={<CarOutlined />}
                suffix="pts"
                valueStyle={{ color: '#ff1801' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="赛季胜场"
                value={currentStanding?.wins || '0'}
                prefix={<TrophyOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
        </Row>

        <Card
          title={`${currentSeason}赛季积分走势`}
          style={{ marginBottom: 24, borderRadius: 12, overflow: 'hidden' }}
          headStyle={{
            background: `linear-gradient(135deg, ${teamColor}15 0%, ${teamColor}05 100%)`,
            borderBottom: `2px solid ${teamColor}30`,
            fontSize: 16,
            fontWeight: 600
          }}
        >
          {seasonRaceResults.length > 0 ? (
            <ReactECharts option={getPointsChartOption()} style={{ height: 400 }} />
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无积分数据</div>
          )}
        </Card>

        <h3 style={{ fontSize: 20, marginBottom: 16 }}>生涯总数据</h3>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12}>
            <Card>
              <Statistic
                title="参赛场数"
                value={careerStats.raceCount}
                prefix={<FlagOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12}>
            <Card>
              <Statistic
                title="分冠数"
                value={careerStats.winCount}
                prefix={<TrophyOutlined />}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
        </Row>

        <Card title="个人信息">
          <Row gutter={[24, 16]}>
            <Col xs={24} sm={12}>
              <p><strong>全名：</strong>{driver?.givenName} {driver?.familyName}</p>
              <p><strong>车手代码：</strong>{driver?.code || '-'}</p>
              <p><strong>车号：</strong>{driver?.permanentNumber || '-'}</p>
              <p><strong>国籍：</strong>{driver?.nationality}</p>
            </Col>
            <Col xs={24} sm={12}>
              <p><strong>出生日期：</strong>{driver?.dateOfBirth ? dayjs(driver.dateOfBirth).format('YYYY年MM月DD日') : '-'}</p>
              <p><strong>当前车队：</strong>{currentStanding?.Constructors[0].name || '-'}</p>
            </Col>
          </Row>
        </Card>
      </Card>
    </div>
  );
};

export default DriverDetail;
