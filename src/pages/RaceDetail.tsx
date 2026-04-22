import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Table, Tabs, Tag } from 'antd';
import { ArrowLeftOutlined, FlagOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { seasonApi } from '@/api/ergast';
import { useSeasonData } from '@/hooks';
import { useAppStore } from '@/store';
import type { QualifyingResult, Result } from '@/types';
import './RaceDetail.css';

interface RaceTabItem {
  key: string;
  label: string;
  data: Array<Result | QualifyingResult>;
  columns: any[];
}

const DEFERRED_TAB_KEYS = ['fp1', 'fp2', 'fp3', 'sprintQualifying', 'sprint'];

const TEXT = {
  loading: '\u52a0\u8f7d\u4e2d...',
  back: '\u8fd4\u56de\u8d5b\u4e8b',
  notFound: '\u672a\u627e\u5230\u8be5\u573a\u6bd4\u8d5b\u4fe1\u606f\u3002',
  rank: '\u6392\u540d',
  driver: '\u8f66\u624b',
  constructor: '\u8f66\u961f',
  grid: '\u53d1\u8f66',
  laps: '\u5708\u6570',
  result: '\u6210\u7ee9',
  fastestLap: '\u6700\u5feb\u5708',
  points: '\u79ef\u5206',
  sprintWeekend: '\u51b2\u523a\u5468\u672b',
  mobileHint: '\u70b9\u51fb\u4e0a\u65b9\u5706\u70b9\u5207\u6362\u4f1a\u8bdd',
  fp1: '\u7ec3\u4e60\u8d5b 1',
  fp2: '\u7ec3\u4e60\u8d5b 2',
  fp3: '\u7ec3\u4e60\u8d5b 3',
  qualifying: '\u6392\u4f4d\u8d5b',
  sprintQualifying: '\u51b2\u523a\u6392\u4f4d\u8d5b',
  sprint: '\u51b2\u523a\u8d5b',
  race: '\u6b63\u8d5b',
};

const RaceDetail = () => {
  const { round } = useParams<{ round: string }>();
  const navigate = useNavigate();
  const { currentSeason } = useAppStore();
  const { races, loading: seasonLoading } = useSeasonData(currentSeason);

  const [qualifyingResults, setQualifyingResults] = useState<QualifyingResult[]>([]);
  const [raceResults, setRaceResults] = useState<Result[]>([]);
  const [sprintResults, setSprintResults] = useState<Result[]>([]);
  const [sprintQualifyingResults, setSprintQualifyingResults] = useState<QualifyingResult[]>([]);
  const [fp1Results, setFp1Results] = useState<Result[]>([]);
  const [fp2Results, setFp2Results] = useState<Result[]>([]);
  const [fp3Results, setFp3Results] = useState<Result[]>([]);
  const [primaryLoading, setPrimaryLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('qualifying');
  const [isMobile, setIsMobile] = useState(false);

  const raceInfo = races.find((race) => race.round === round) || null;

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!round) {
      return;
    }

    let cancelled = false;

    setActiveTab('qualifying');
    setQualifyingResults([]);
    setRaceResults([]);
    setPrimaryLoading(true);

    const loadPrimaryData = async () => {
      const [qualifyingData, raceResultsData] = await Promise.allSettled([
        seasonApi.getQualifyingResults(currentSeason, round),
        seasonApi.getRaceResults(currentSeason, round),
      ]);

      if (cancelled) {
        return;
      }

      setQualifyingResults(
        qualifyingData.status === 'fulfilled' ? qualifyingData.value?.QualifyingResults || [] : [],
      );
      setRaceResults(
        raceResultsData.status === 'fulfilled' ? raceResultsData.value?.Results || [] : [],
      );
      setPrimaryLoading(false);
    };

    void loadPrimaryData();

    return () => {
      cancelled = true;
    };
  }, [currentSeason, round]);

  useEffect(() => {
    if (!round) {
      return;
    }

    let cancelled = false;

    setSprintResults([]);
    setSprintQualifyingResults([]);
    setFp1Results([]);
    setFp2Results([]);
    setFp3Results([]);
    setSessionsLoading(true);

    const loadDeferredSessions = async () => {
      const [sprintData, sprintQualifyingData, fp1Data, fp2Data, fp3Data] = await Promise.allSettled([
        seasonApi.getSprintResults(currentSeason, round),
        seasonApi.getSprintQualifyingResults(currentSeason, round),
        seasonApi.getPracticeResults(currentSeason, round, 1),
        seasonApi.getPracticeResults(currentSeason, round, 2),
        seasonApi.getPracticeResults(currentSeason, round, 3),
      ]);

      if (cancelled) {
        return;
      }

      setSprintResults(sprintData.status === 'fulfilled' ? sprintData.value?.Results || [] : []);
      setSprintQualifyingResults(
        sprintQualifyingData.status === 'fulfilled' ? sprintQualifyingData.value?.QualifyingResults || [] : [],
      );
      setFp1Results(fp1Data.status === 'fulfilled' ? fp1Data.value?.Results || [] : []);
      setFp2Results(fp2Data.status === 'fulfilled' ? fp2Data.value?.Results || [] : []);
      setFp3Results(fp3Data.status === 'fulfilled' ? fp3Data.value?.Results || [] : []);
      setSessionsLoading(false);
    };

    void loadDeferredSessions();

    return () => {
      cancelled = true;
    };
  }, [currentSeason, round]);

  const qualifyingColumns = [
    { title: TEXT.rank, dataIndex: 'position', key: 'position', width: 60 },
    {
      title: TEXT.driver,
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
      title: TEXT.constructor,
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
    data.forEach((result) => {
      if (result.FastestLap?.Time?.time) {
        if (!fastestLapTime || result.FastestLap.Time.time < fastestLapTime) {
          fastestLapTime = result.FastestLap.Time.time;
        }
      }
    });

    return [
      { title: TEXT.rank, dataIndex: 'position', key: 'position', width: 60 },
      { title: TEXT.grid, dataIndex: 'grid', key: 'grid', width: 60 },
      {
        title: TEXT.driver,
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
        title: TEXT.constructor,
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
      { title: TEXT.laps, dataIndex: 'laps', key: 'laps', width: 60 },
      {
        title: TEXT.result,
        key: 'time',
        render: (_: unknown, record: Result) => record.Time?.time || record.status,
      },
      {
        title: TEXT.fastestLap,
        key: 'fastestLap',
        render: (_: unknown, record: Result) => {
          const time = record.FastestLap?.Time?.time;
          if (!time) {
            return '-';
          }

          return time === fastestLapTime ? (
            <span className="fastest-lap">{time} *</span>
          ) : time;
        },
      },
      {
        title: TEXT.points,
        dataIndex: 'points',
        key: 'points',
        width: 60,
        render: (points: string) => <span className="points">{points}</span>,
      },
    ];
  };

  if ((seasonLoading || primaryLoading) && !raceInfo) {
    return <div>{TEXT.loading}</div>;
  }

  if (!raceInfo) {
    return (
      <div className="race-detail-page">
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(-1)}
          className="back-button"
        >
          {TEXT.back}
        </Button>

        <Card>
          <p>{TEXT.notFound}</p>
        </Card>
      </div>
    );
  }

  const hasFp1 = fp1Results.length > 0;
  const hasFp2 = fp2Results.length > 0;
  const hasFp3 = fp3Results.length > 0;
  const hasSprintQualifying = sprintQualifyingResults.length > 0;
  const hasSprint = sprintResults.length > 0;
  const isSprintWeekend = hasSprint || hasSprintQualifying;

  const tabItems: RaceTabItem[] = [
    hasFp1 && { key: 'fp1', label: TEXT.fp1, data: fp1Results, columns: getRaceColumns(fp1Results) },
    hasFp2 && { key: 'fp2', label: TEXT.fp2, data: fp2Results, columns: getRaceColumns(fp2Results) },
    hasFp3 && { key: 'fp3', label: TEXT.fp3, data: fp3Results, columns: getRaceColumns(fp3Results) },
    { key: 'qualifying', label: TEXT.qualifying, data: qualifyingResults, columns: qualifyingColumns },
    hasSprintQualifying && {
      key: 'sprintQualifying',
      label: TEXT.sprintQualifying,
      data: sprintQualifyingResults,
      columns: qualifyingColumns,
    },
    hasSprint && { key: 'sprint', label: TEXT.sprint, data: sprintResults, columns: getRaceColumns(sprintResults) },
    { key: 'race', label: TEXT.race, data: raceResults, columns: getRaceColumns(raceResults) },
  ].filter(Boolean) as RaceTabItem[];

  const effectiveActiveTab = tabItems.find((item) => item.key === activeTab)?.key || tabItems[0]?.key || 'qualifying';
  const currentTabIndex = tabItems.findIndex((item) => item.key === effectiveActiveTab);
  const currentItem = tabItems.find((item) => item.key === effectiveActiveTab);

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

  const getTableLoading = (tabKey: string, data: Array<Result | QualifyingResult>) => {
    if (seasonLoading || primaryLoading) {
      return true;
    }

    return DEFERRED_TAB_KEYS.includes(tabKey) && sessionsLoading && data.length === 0;
  };

  return (
    <div className="race-detail-page">
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(-1)}
        className="back-button"
      >
        {TEXT.back}
      </Button>

      <Card loading={seasonLoading || primaryLoading} className="race-info-card">
        <div className="race-header">
          <div>
            <h1 className="race-title">
              <FlagOutlined className="race-flag-icon" />
              {raceInfo.raceName}
            </h1>
            <p className="race-circuit">
              {raceInfo.Circuit.circuitName}
              {' - '}
              {raceInfo.Circuit.Location.locality}, {raceInfo.Circuit.Location.country}
            </p>
            <Tag color="blue" className="race-date">
              {dayjs(raceInfo.date).format('YYYY-MM-DD')}
            </Tag>
            {isSprintWeekend ? (
              <Tag color="orange" className="sprint-tag">
                {TEXT.sprintWeekend}
              </Tag>
            ) : null}
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
                disabled={currentTabIndex <= 0}
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
                rowKey={(record) => record.Driver.driverId}
                pagination={false}
                loading={currentItem ? getTableLoading(currentItem.key, currentItem.data) : false}
                scroll={{ x: 'max-content' }}
                size="small"
              />
            </div>
            <div className="swipe-hint">{TEXT.mobileHint}</div>
          </div>
        ) : (
          <Tabs
            activeKey={effectiveActiveTab}
            onChange={setActiveTab}
            items={tabItems.map((item) => ({
              key: item.key,
              label: item.label,
              children: (
                <Table
                  columns={item.columns}
                  dataSource={item.data}
                  rowKey={(record) => record.Driver.driverId}
                  pagination={false}
                  loading={getTableLoading(item.key, item.data)}
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
