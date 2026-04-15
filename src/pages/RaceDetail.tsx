import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Tabs, Table, Tag } from 'antd';
import { ArrowLeftOutlined, FlagOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import { useAppStore } from '@/store';
import { seasonApi } from '@/api/ergast';
import type { Race, Result, QualifyingResult } from '@/types';
import dayjs from 'dayjs';
import './RaceDetail.css';

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
  const [activeTab, setActiveTab] = useState('qualifying');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      if (!round) return;
      setLoading(true);

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
    { title: '排名', dataIndex: 'position', key: 'position', width: 60 },
    {
      title: '车手',
      key: 'driver',
      render: (_: unknown, record: QualifyingResult) => (
        <div>
          <div
            className="driver-name"
            onClick={() => navigate(`/drivers/${record.Driver.driverId}`)}
          >
            {record.Driver.givenName} {record.Driver.familyName}
          </div>
          <div className="driver-code">{record.Driver.code}</div>
        </div>
      ),
    },
    {
      title: '车队',
      key: 'constructor',
      render: (_: unknown, record: QualifyingResult) => (
        <span
          className="constructor-name"
          onClick={() => navigate(`/constructors/${record.Constructor.constructorId}`)}
        >
          {record.Constructor.name}
        </span>
      ),
    },
    { title: 'Q1', dataIndex: 'Q1', key: 'Q1', width: 80 },
    { title: 'Q2', dataIndex: 'Q2', key: 'Q2', width: 80 },
    { title: 'Q3', dataIndex: 'Q3', key: 'Q3', width: 80 },
  ];

  const getRaceColumns = (data: Result[]) => {
    let fastestLapTime = '';
    data.forEach(result => {
      if (result.FastestLap?.Time?.time) {
        if (!fastestLapTime || result.FastestLap.Time.time < fastestLapTime) {
          fastestLapTime = result.FastestLap.Time.time;
        }
      }
    });

    return [
      { title: '排名', dataIndex: 'position', key: 'position', width: 60 },
      { title: '发车', dataIndex: 'grid', key: 'grid', width: 60 },
      {
        title: '车手',
        key: 'driver',
        render: (_: unknown, record: Result) => (
          <div>
            <div
              className="driver-name"
              onClick={() => navigate(`/drivers/${record.Driver.driverId}`)}
            >
              {record.Driver.givenName} {record.Driver.familyName}
            </div>
            <div className="driver-code">{record.Driver.code}</div>
          </div>
        ),
      },
      {
        title: '车队',
        key: 'constructor',
        render: (_: unknown, record: Result) => (
          <span
            className="constructor-name"
            onClick={() => navigate(`/constructors/${record.Constructor.constructorId}`)}
          >
            {record.Constructor.name}
          </span>
        ),
      },
      { title: '圈数', dataIndex: 'laps', key: 'laps', width: 60 },
      { title: '成绩', key: 'time', render: (_: unknown, record: Result) => record.Time?.time || record.status },
      {
        title: '最快圈',
        key: 'fastestLap',
        render: (_: unknown, record: Result) => {
          const time = record.FastestLap?.Time?.time;
          if (!time) return '-';
          return time === fastestLapTime ? (
            <span className="fastest-lap">{time} ⚡</span>
          ) : time;
        },
      },
      {
        title: '积分',
        dataIndex: 'points',
        key: 'points',
        width: 60,
        render: (points: string) => <span className="points">{points}</span>,
      },
    ];
  };

  if (!raceInfo) {
    return <div>加载中...</div>;
  }

  const hasFp1 = fp1Results.length > 0;
  const hasFp2 = fp2Results.length > 0;
  const hasFp3 = fp3Results.length > 0;
  const hasSprintQualifying = sprintQualifyingResults.length > 0;
  const hasSprint = sprintResults.length > 0;
  const isSprintWeekend = hasSprint || hasSprintQualifying;

  const tabItems = [
    hasFp1 && { key: 'fp1', label: '练习赛1', data: fp1Results, columns: getRaceColumns(fp1Results) },
    hasFp2 && { key: 'fp2', label: '练习赛2', data: fp2Results, columns: getRaceColumns(fp2Results) },
    hasFp3 && { key: 'fp3', label: '练习赛3', data: fp3Results, columns: getRaceColumns(fp3Results) },
    { key: 'qualifying', label: '排位赛', data: qualifyingResults, columns: qualifyingColumns },
    hasSprintQualifying && { key: 'sprintQualifying', label: '冲刺排位赛', data: sprintQualifyingResults, columns: qualifyingColumns },
    hasSprint && { key: 'sprint', label: '冲刺赛', data: sprintResults, columns: getRaceColumns(sprintResults) },
    { key: 'race', label: '正赛', data: raceResults, columns: getRaceColumns(raceResults) },
  ].filter(Boolean) as { key: string; label: string; data: any[]; columns: any[] }[];

  const currentTabIndex = tabItems.findIndex(item => item.key === activeTab);

  const handlePrevTab = () => {
    if (currentTabIndex > 0) {
      setActiveTab(tabItems[currentTabIndex - 1].key);
    }
  };

  const handleNextTab = () => {
    if (currentTabIndex < tabItems.length - 1) {
      setActiveTab(tabItems[currentTabIndex + 1].key);
    }
  };

  const currentItem = tabItems.find(item => item.key === activeTab);

  return (
    <div className="race-detail-page">
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(-1)}
        className="back-button"
      >
        返回赛历
      </Button>

      <Card loading={loading} className="race-info-card">
        <div className="race-header">
          <div>
            <h1 className="race-title">
              <FlagOutlined className="race-flag-icon" />
              {raceInfo?.raceName || '加载中...'}
            </h1>
            {raceInfo && (
              <>
                <p className="race-circuit">
                  {raceInfo.Circuit.circuitName} · {raceInfo.Circuit.Location.locality}, {raceInfo.Circuit.Location.country}
                </p>
                <Tag color="blue" className="race-date">
                  {dayjs(raceInfo.date).format('YYYY-MM-DD')}
                </Tag>
                {isSprintWeekend && (
                  <Tag color="orange" className="sprint-tag">
                    冲刺赛周末
                  </Tag>
                )}
              </>
            )}
          </div>
        </div>
      </Card>

      <Card className="results-card">
        {isMobile ? (
          <div className="mobile-slider-container">
            <div className="slider-header">
              <Button
                icon={<LeftOutlined />}
                onClick={handlePrevTab}
                disabled={currentTabIndex === 0}
                className="nav-button"
              />
              <div className="tab-indicators">
                {tabItems.map((item, index) => (
                  <span
                    key={item.key}
                    className={`tab-dot ${index === currentTabIndex ? 'active' : ''}`}
                    onClick={() => setActiveTab(item.key)}
                  />
                ))}
              </div>
              <Button
                icon={<RightOutlined />}
                onClick={handleNextTab}
                disabled={currentTabIndex === tabItems.length - 1}
                className="nav-button"
              />
            </div>
            <div className="current-tab-label">{currentItem?.label}</div>
            <div className="slider-content">
              <Table
                columns={currentItem?.columns}
                dataSource={currentItem?.data}
                rowKey="position"
                pagination={false}
                loading={loading}
                scroll={{ x: 'max-content' }}
                size="small"
              />
            </div>
            <div className="swipe-hint">Tap the dots above to switch</div>
          </div>
        ) : (
          <Tabs
            defaultActiveKey="qualifying"
            items={tabItems.map(item => ({
              key: item.key,
              label: item.label,
              children: (
                <Table
                  columns={item.columns}
                  dataSource={item.data}
                  rowKey="position"
                  pagination={false}
                  loading={loading}
                />
              ),
            }))}
          />
        )}
      </Card>
    </div>
  );
};

export default RaceDetail;
