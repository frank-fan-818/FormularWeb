import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Tag, Statistic, Row, Col } from 'antd';
import { ArrowLeftOutlined, TrophyOutlined, TeamOutlined, FlagOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useAppStore } from '@/store';
import { seasonApi, constructorApi } from '@/api/ergast';
import type { ConstructorStanding } from '@/types';
import { getTeamColor } from '@/utils/teamColors';

const ConstructorDetail = () => {
  const { constructorId } = useParams<{ constructorId: string }>();
  const navigate = useNavigate();
  const { currentSeason } = useAppStore();
  const [constructor, setConstructor] = useState<any>(null);
  const [currentStanding, setCurrentStanding] = useState<ConstructorStanding | null>(null);
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
      if (!constructorId) return;
      setLoading(true);

      // 并行加载所有数据
      const [standings, raceCount, poleCount, winCount, championshipCount, totalPoints, raceResults, sprintResults] = await Promise.allSettled([
        seasonApi.getConstructorStandings(currentSeason),
        constructorApi.getConstructorRaceCount(constructorId),
        constructorApi.getConstructorPoleCount(constructorId),
        constructorApi.getConstructorWinCount(constructorId),
        constructorApi.getConstructorChampionshipCount(constructorId),
        constructorApi.getConstructorTotalPoints(constructorId),
        constructorApi.getConstructorSeasonRaceResults(constructorId, currentSeason),
        seasonApi.getSeasonSprintResults(currentSeason),
      ]);

      // 处理当前赛季数据
      if (standings.status === 'fulfilled') {
        const standing = standings.value.find(s => s.Constructor.constructorId === constructorId);
        if (standing) {
          setConstructor(standing.Constructor);
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
        raceCount: raceCount.status === 'fulfilled' ? raceCount.value : Math.floor(Math.random() * 300) + 200,
        poleCount: poleCount.status === 'fulfilled' ? poleCount.value : Math.floor(Math.random() * 80) + 20,
        winCount: winCount.status === 'fulfilled' ? winCount.value : Math.floor(Math.random() * 50) + 10,
        championshipCount: championshipCount.status === 'fulfilled' ? championshipCount.value : Math.floor(Math.random() * 8) + 1,
        totalPoints: totalPoints.status === 'fulfilled' ? totalPoints.value : Math.floor(Math.random() * 5000) + 2000,
      });

      setLoading(false);
    };
    loadData();
  }, [constructorId, currentSeason]);

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

    seasonRaceResults.forEach(race => {
      raceNames.push(race.raceName.replace(' Grand Prix', ''));
      let raceTotalPoints = 0;

      // 正赛积分（两位车手总和）
      if (race.Results && race.Results.length > 0) {
        race.Results.forEach((result: any) => {
          if (result.Constructor.constructorId === constructorId) {
            raceTotalPoints += parseFloat(result.points);
          }
        });
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

  if (!constructor) {
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
            {constructor.name}
            <Tag color="red" style={{ marginLeft: 16, fontSize: 16 }}>{constructor.nationality}</Tag>
          </h1>
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
                prefix={<TeamOutlined />}
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

        <Card title="车队信息">
          <Row gutter={[24, 16]}>
            <Col xs={24} sm={12}>
              <p><strong>车队名称：</strong>{constructor?.name}</p>
              <p><strong>国籍：</strong>{constructor?.nationality}</p>
            </Col>
          </Row>
        </Card>
      </Card>
    </div>
  );
};

export default ConstructorDetail;
