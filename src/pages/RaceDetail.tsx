import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Tabs, Table, Tag } from 'antd';
import { ArrowLeftOutlined, FlagOutlined } from '@ant-design/icons';
import { useAppStore } from '@/store';
import { seasonApi } from '@/api/ergast';
import type { Race, Result, QualifyingResult } from '@/types';
import dayjs from 'dayjs';

const RaceDetail = () => {
  const { round } = useParams<{ round: string }>();
  const navigate = useNavigate();
  const { currentSeason } = useAppStore();
  const [raceInfo, setRaceInfo] = useState<Race | null>(null);
  const [qualifyingResults, setQualifyingResults] = useState<QualifyingResult[]>([]);
  const [raceResults, setRaceResults] = useState<Result[]>([]);
  const [sprintResults, setSprintResults] = useState<Result[]>([]);
  const [sprintQualifyingResults, setSprintQualifyingResults] = useState<QualifyingResult[]>([]);
  const [fp1Results, setFp1Results] = useState<Result[]>([]);
  const [fp2Results, setFp2Results] = useState<Result[]>([]);
  const [fp3Results, setFp3Results] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!round) return;
      setLoading(true);

      // 加载所有比赛环节数据
      const [
        raceData,
        qualifyingData,
        raceResultsData,
        sprintData,
        sprintQualifyingData,
        fp1Data,
        fp2Data,
        fp3Data
      ] = await Promise.allSettled([
        seasonApi.getSeasonRaces(currentSeason).then(races => races.find(r => r.round === round) || null),
        seasonApi.getQualifyingResults(currentSeason, round),
        seasonApi.getRaceResults(currentSeason, round),
        seasonApi.getSprintResults(currentSeason, round),
        seasonApi.getSprintQualifyingResults(currentSeason, round),
        seasonApi.getPracticeResults(currentSeason, round, 1),
        seasonApi.getPracticeResults(currentSeason, round, 2),
        seasonApi.getPracticeResults(currentSeason, round, 3),
      ]);

      setRaceInfo(raceData.status === 'fulfilled' ? raceData.value : null);
      setQualifyingResults(qualifyingData.status === 'fulfilled' ? qualifyingData.value?.QualifyingResults || [] : []);
      setRaceResults(raceResultsData.status === 'fulfilled' ? raceResultsData.value?.Results || [] : []);
      setSprintResults(sprintData.status === 'fulfilled' ? sprintData.value?.Results || [] : []);
      setSprintQualifyingResults(sprintQualifyingData.status === 'fulfilled' ? sprintQualifyingData.value?.QualifyingResults || [] : []);
      setFp1Results(fp1Data.status === 'fulfilled' ? fp1Data.value?.Results || [] : []);
      setFp2Results(fp2Data.status === 'fulfilled' ? fp2Data.value?.Results || [] : []);
      setFp3Results(fp3Data.status === 'fulfilled' ? fp3Data.value?.Results || [] : []);

      setLoading(false);
    };
    loadData();
  }, [round, currentSeason]);

  const qualifyingColumns = [
    {
      title: '排名',
      dataIndex: 'position',
      key: 'position',
      width: 80,
    },
    {
      title: '车手',
      key: 'driver',
      render: (_: unknown, record: QualifyingResult) => (
        <div>
          <div
            style={{ fontWeight: 500, color: '#1890ff', cursor: 'pointer' }}
            onClick={() => navigate(`/drivers/${record.Driver.driverId}`)}
          >
            {record.Driver.givenName} {record.Driver.familyName}
          </div>
          <div style={{ fontSize: 12, color: '#666' }}>{record.Driver.code}</div>
        </div>
      ),
    },
    {
      title: '车队',
      key: 'constructor',
      render: (_: unknown, record: QualifyingResult) => (
        <div
          style={{ color: '#1890ff', cursor: 'pointer' }}
          onClick={() => navigate(`/constructors/${record.Constructor.constructorId}`)}
        >
          {record.Constructor.name}
        </div>
      ),
    },
    {
      title: 'Q1',
      dataIndex: 'Q1',
      key: 'Q1',
      width: 100,
    },
    {
      title: 'Q2',
      dataIndex: 'Q2',
      key: 'Q2',
      width: 100,
    },
    {
      title: 'Q3',
      dataIndex: 'Q3',
      key: 'Q3',
      width: 100,
    },
  ];

  // 正赛/冲刺赛表格列
  const getRaceColumns = (data: Result[]) => {
    // 找到最快圈速
    let fastestLapTime = '';
    data.forEach(result => {
      if (result.FastestLap?.Time?.time) {
        if (!fastestLapTime || result.FastestLap.Time.time < fastestLapTime) {
          fastestLapTime = result.FastestLap.Time.time;
        }
      }
    });

    return [
      {
        title: '排名',
        dataIndex: 'position',
        key: 'position',
        width: 80,
      },
      {
        title: '发车位置',
        dataIndex: 'grid',
        key: 'grid',
        width: 100,
      },
      {
        title: '车手',
        key: 'driver',
        render: (_: unknown, record: Result) => (
          <div>
            <div
              style={{ fontWeight: 500, color: '#1890ff', cursor: 'pointer' }}
              onClick={() => navigate(`/drivers/${record.Driver.driverId}`)}
            >
              {record.Driver.givenName} {record.Driver.familyName}
            </div>
            <div style={{ fontSize: 12, color: '#666' }}>{record.Driver.code}</div>
          </div>
        ),
      },
      {
        title: '车队',
        key: 'constructor',
        render: (_: unknown, record: Result) => (
          <div
            style={{ color: '#1890ff', cursor: 'pointer' }}
            onClick={() => navigate(`/constructors/${record.Constructor.constructorId}`)}
          >
            {record.Constructor.name}
          </div>
        ),
      },
      {
        title: '圈数',
        dataIndex: 'laps',
        key: 'laps',
        width: 80,
      },
      {
        title: '成绩',
        key: 'time',
        render: (_: unknown, record: Result) => record.Time?.time || record.status,
      },
      {
        title: '最快圈',
        key: 'fastestLap',
        render: (_: unknown, record: Result) => {
          const time = record.FastestLap?.Time?.time;
          if (!time) return '-';
          return time === fastestLapTime ? (
            <span style={{ color: '#faad14', fontWeight: 'bold' }}>{time} ⚡</span>
          ) : time;
        },
      },
      {
        title: '积分',
        dataIndex: 'points',
        key: 'points',
        width: 80,
        render: (points: string) => <span style={{ fontWeight: 'bold', color: '#ff1801' }}>{points}</span>,
      },
    ];
  };

  if (!raceInfo) {
    return <div>加载中...</div>;
  }

  // 判断各个环节是否有数据
  const hasFp1 = fp1Results.length > 0;
  const hasFp2 = fp2Results.length > 0;
  const hasFp3 = fp3Results.length > 0;
  const hasSprintQualifying = sprintQualifyingResults.length > 0;
  const hasSprint = sprintResults.length > 0;
  const isSprintWeekend = hasSprint || hasSprintQualifying;

  // 生成Tabs的items配置
  const tabItems = [
    hasFp1 && {
      key: 'fp1',
      label: '练习赛1',
      children: (
        <Table
          columns={getRaceColumns(fp1Results)}
          dataSource={fp1Results}
          rowKey="position"
          pagination={false}
          loading={loading}
        />
      )
    },
    hasFp2 && {
      key: 'fp2',
      label: '练习赛2',
      children: (
        <Table
          columns={getRaceColumns(fp2Results)}
          dataSource={fp2Results}
          rowKey="position"
          pagination={false}
          loading={loading}
        />
      )
    },
    hasFp3 && {
      key: 'fp3',
      label: '练习赛3',
      children: (
        <Table
          columns={getRaceColumns(fp3Results)}
          dataSource={fp3Results}
          rowKey="position"
          pagination={false}
          loading={loading}
        />
      )
    },
    {
      key: 'qualifying',
      label: '排位赛',
      children: (
        <Table
          columns={qualifyingColumns}
          dataSource={qualifyingResults}
          rowKey="position"
          pagination={false}
          loading={loading}
        />
      )
    },
    hasSprintQualifying && {
      key: 'sprintQualifying',
      label: '冲刺排位赛',
      children: (
        <Table
          columns={qualifyingColumns}
          dataSource={sprintQualifyingResults}
          rowKey="position"
          pagination={false}
          loading={loading}
        />
      )
    },
    hasSprint && {
      key: 'sprint',
      label: '冲刺赛',
      children: (
        <Table
          columns={getRaceColumns(sprintResults)}
          dataSource={sprintResults}
          rowKey="position"
          pagination={false}
          loading={loading}
        />
      )
    },
    {
      key: 'race',
      label: '正赛',
      children: (
        <Table
          columns={getRaceColumns(raceResults)}
          dataSource={raceResults}
          rowKey="position"
          pagination={false}
          loading={loading}
        />
      )
    }
  ].filter(Boolean) as any[];

  return (
    <div>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(-1)}
        style={{ marginBottom: 24 }}
      >
        返回赛历
      </Button>

      <Card loading={loading} style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 32, marginBottom: 8 }}>
              <FlagOutlined style={{ marginRight: 12, color: '#ff1801' }} />
              {raceInfo?.raceName || '加载中...'}
            </h1>
            {raceInfo && (
              <>
                <p style={{ fontSize: 18, color: '#666', marginBottom: 16 }}>
                  {raceInfo.Circuit.circuitName} · {raceInfo.Circuit.Location.locality}, {raceInfo.Circuit.Location.country}
                </p>
                <Tag color="blue" style={{ fontSize: 16, padding: '4px 12px' }}>
                  {dayjs(raceInfo.date).format('YYYY年MM月DD日')}
                </Tag>
                {isSprintWeekend && (
                  <Tag color="orange" style={{ fontSize: 16, padding: '4px 12px', marginLeft: 8 }}>
                    冲刺赛周末
                  </Tag>
                )}
              </>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <Tabs defaultActiveKey="qualifying" items={tabItems} />
      </Card>
    </div>
  );
};

export default RaceDetail;
