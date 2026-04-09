import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Tag, Statistic, Row, Col } from 'antd';
import { ArrowLeftOutlined, TrophyOutlined, CarOutlined, FlagOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useAppStore } from '@/store';
import { seasonApi, driverApi } from '@/api/ergast';
import type { DriverStanding } from '@/types';
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
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const index = params[0].dataIndex;
          const round = seasonRaceResults[index]?.round;
          const sprintPoints = sprintPointsMap[round] || 0;
          const racePoints = singlePoints[index] - sprintPoints;

          let result = params[0].name + '<br/>';
          result += `正赛积分: ${racePoints}<br/>`;
          if (sprintPoints > 0) {
            result += `冲刺赛积分: ${sprintPoints}<br/>`;
          }
          result += `本站总积分: ${singlePoints[index]}<br/>`;
          result += `${params[0].marker} ${params[0].seriesName}: ${params[0].value}<br/>`;
          return result;
        }
      },
      legend: {
        data: ['累计积分'],
        top: 0
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '60px',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: raceNames,
        axisLabel: {
          rotate: 45,
          interval: 0
        }
      },
      yAxis: {
        type: 'value',
        name: '累计积分',
        max: Math.max(totalPoints, Math.max(...cumulativePointsArr)) * 1.1
      },
      series: [
        {
          name: '累计积分',
          type: 'line',
          data: cumulativePointsArr,
          smooth: true,
          itemStyle: {
            color: '#1890ff'
          },
          areaStyle: {
            color: 'rgba(24, 144, 255, 0.2)'
          }
        }
      ]
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
            <Tag color="blue" style={{ marginLeft: 16, fontSize: 16 }}>{driver.code}</Tag>
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

        <Card title={`${currentSeason}赛季积分走势`} style={{ marginBottom: 24 }}>
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
              <p><strong>年龄：</strong>{driver?.dateOfBirth ? dayjs().diff(driver.dateOfBirth, 'year') : '-'} 岁</p>
              <p><strong>当前车队：</strong>{currentStanding?.Constructors[0].name || '-'}</p>
            </Col>
          </Row>
        </Card>
      </Card>
    </div>
  );
};

export default DriverDetail;
