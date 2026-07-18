import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Empty, Table, Tabs } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { QualifyingResult, Result } from '@/types';
import { getTeamColor } from '@/utils/teamColors';
import { DriverAvatar } from '@/utils/driverImages';
import { ConstructorLogo } from '@/utils/constructorLogos';
import { LIGHT_TAG_COLORS, DEFERRED_TAB_KEYS } from '@/pages/Race/shared/constants';
import { RaceOverviewPanel } from '@/pages/Race/shared/components/RaceOverviewPanel';
import { RacePageIntro } from '@/pages/Race/shared/components/RacePageIntro';
import { buildRaceOverviewInsights } from '@/utils/raceOverviewInsights';
import { useRaceData } from './RaceContext';
import '../RaceDetail.css';

interface TabItem {
  key: string;
  label: string;
  data: (Result | QualifyingResult)[];
  columns: ColumnsType<Result | QualifyingResult>;
}

const SESSION_CODES: Record<string, string> = {
  fp1: 'FP1',
  fp2: 'FP2',
  fp3: 'FP3',
  sprintQualifying: 'SQ',
  sprint: 'S',
  qualifying: 'Q',
  race: 'R',
};

const RaceResults = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    raceResults,
    qualifyingResults,
    sprintResults,
    sprintQualifyingResults,
    fp1Results,
    fp2Results,
    fp3Results,
    raceInfo,
    availableDbSessions,
    primaryLoading,
    loadingSessionTabs,
    loadedSessionTabs,
    sessionLoadErrors,
    retryActiveSession,
    fastF1Analytics,
    activeTab,
    setActiveTab,
  } = useRaceData();

  const hasFp1 =
    Boolean(raceInfo?.FirstPractice) || availableDbSessions.includes('FP1') || fp1Results.length > 0;
  const hasFp2 =
    Boolean(raceInfo?.SecondPractice) || availableDbSessions.includes('FP2') || fp2Results.length > 0;
  const hasFp3 =
    Boolean(raceInfo?.ThirdPractice) || availableDbSessions.includes('FP3') || fp3Results.length > 0;
  const hasSprintQualifying =
    Boolean(raceInfo?.SprintQualifying)
    || availableDbSessions.includes('SQ')
    || availableDbSessions.includes('SS')
    || sprintQualifyingResults.length > 0;
  const hasSprint =
    Boolean(raceInfo?.Sprint)
    || availableDbSessions.includes('S')
    || sprintResults.length > 0;
  const insights = useMemo(
    () => buildRaceOverviewInsights(raceResults, qualifyingResults, fastF1Analytics),
    [fastF1Analytics, qualifyingResults, raceResults],
  );

  const getTableLoading = (tabKey: string, data: unknown[]): boolean => {
    if (primaryLoading) return true;
    return DEFERRED_TAB_KEYS.includes(tabKey) && loadingSessionTabs.includes(tabKey) && data.length === 0;
  };

  const renderEmptyState = (tabKey: string) => {
    const failed = sessionLoadErrors[tabKey];
    const deferred = DEFERRED_TAB_KEYS.includes(tabKey);
    const loaded = loadedSessionTabs.includes(tabKey);
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={failed
          ? '该场次数据加载失败'
          : deferred && loaded
            ? '该场次暂无已收录的完整数据'
            : '该场次数据尚未发布'}
      >
        {failed ? <Button onClick={retryActiveSession}>重试此场次</Button> : null}
      </Empty>
    );
  };

  // Race columns -----------------------------------------------------------
  const raceColumns: ColumnsType<Result> = useMemo(() => {
    let fastestLapTime = '';
    raceResults.forEach((result) => {
      if (result.FastestLap?.Time?.time) {
        if (!fastestLapTime || result.FastestLap.Time.time < fastestLapTime) {
          fastestLapTime = result.FastestLap.Time.time;
        }
      }
    });

    return [
      { title: t('rank'), dataIndex: 'position', key: 'position', width: 60 },
      { title: t('grid'), dataIndex: 'grid', key: 'grid', width: 60 },
      {
        title: t('driver'),
        key: 'driver',
        render: (_: unknown, record: Result) => {
          const color = getTeamColor(record.Constructor.constructorId);
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <DriverAvatar driverId={record.Driver.driverId} size={32} givenName={record.Driver.givenName} familyName={record.Driver.familyName} />
              <span
                onClick={() => navigate(`/drivers/${record.Driver.driverId}`)}
                style={{
                  display: 'inline-block',
                  backgroundColor: color,
                  color: LIGHT_TAG_COLORS.has(color) ? '#111827' : '#fff',
                  fontWeight: 700,
                  fontSize: 12,
                  padding: '2px 6px',
                  borderRadius: 3,
                  minWidth: 36,
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                {record.Driver.code}
              </span>
              <ConstructorLogo constructorId={record.Constructor.constructorId} size={24} />
              <span style={{ fontWeight: 500, fontSize: 13 }}>
                {record.Driver.givenName} {record.Driver.familyName}
              </span>
            </div>
          );
        },
      },
      { title: t('laps'), dataIndex: 'laps', key: 'laps', width: 60 },
      {
        title: t('result'),
        key: 'time',
        render: (_: unknown, record: Result) => record.Time?.time || record.status,
      },
      {
        title: t('fastestLap'),
        key: 'fastestLap',
        render: (_: unknown, record: Result) => {
          const time = record.FastestLap?.Time?.time;
          if (!time) return '-';
          return time === fastestLapTime ? (
            <span className="fastest-lap">{time} *</span>
          ) : (
            time
          );
        },
      },
      {
        title: t('points'),
        dataIndex: 'points',
        key: 'points',
        width: 60,
        render: (points: string) => <span className="points">{points}</span>,
      },
    ];
  }, [raceResults, t, navigate]);

  // Qualifying columns ------------------------------------------------------
  const qualifyingColumns: ColumnsType<QualifyingResult> = useMemo(
    () => [
      { title: t('rank'), dataIndex: 'position', key: 'position', width: 60 },
      {
        title: t('driver'),
        key: 'driver',
        render: (_: unknown, record: QualifyingResult) => {
          const color = getTeamColor(record.Constructor.constructorId);
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <DriverAvatar driverId={record.Driver.driverId} size={32} givenName={record.Driver.givenName} familyName={record.Driver.familyName} />
              <span
                onClick={() => navigate(`/drivers/${record.Driver.driverId}`)}
                style={{
                  display: 'inline-block',
                  backgroundColor: color,
                  color: LIGHT_TAG_COLORS.has(color) ? '#111827' : '#fff',
                  fontWeight: 700,
                  fontSize: 12,
                  padding: '2px 6px',
                  borderRadius: 3,
                  minWidth: 36,
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                {record.Driver.code}
              </span>
              <ConstructorLogo constructorId={record.Constructor.constructorId} size={24} />
              <span style={{ fontWeight: 500, fontSize: 13 }}>
                {record.Driver.givenName} {record.Driver.familyName}
              </span>
            </div>
          );
        },
      },
      { title: 'Q1', dataIndex: 'Q1', key: 'Q1', width: 90 },
      { title: 'Q2', dataIndex: 'Q2', key: 'Q2', width: 90 },
      { title: 'Q3', dataIndex: 'Q3', key: 'Q3', width: 90 },
    ],
    [t, navigate],
  );

  // Sprint Qualifying columns -----------------------------------------------
  const sprintQualifyingColumns: ColumnsType<QualifyingResult> = useMemo(
    () => [
      { title: t('rank'), dataIndex: 'position', key: 'position', width: 60 },
      {
        title: t('driver'),
        key: 'driver',
        render: (_: unknown, record: QualifyingResult) => {
          const color = getTeamColor(record.Constructor.constructorId);
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <DriverAvatar driverId={record.Driver.driverId} size={32} givenName={record.Driver.givenName} familyName={record.Driver.familyName} />
              <span
                onClick={() => navigate(`/drivers/${record.Driver.driverId}`)}
                style={{
                  display: 'inline-block',
                  backgroundColor: color,
                  color: LIGHT_TAG_COLORS.has(color) ? '#111827' : '#fff',
                  fontWeight: 700,
                  fontSize: 12,
                  padding: '2px 6px',
                  borderRadius: 3,
                  minWidth: 36,
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                {record.Driver.code}
              </span>
              <ConstructorLogo constructorId={record.Constructor.constructorId} size={24} />
              <span style={{ fontWeight: 500, fontSize: 13 }}>
                {record.Driver.givenName} {record.Driver.familyName}
              </span>
            </div>
          );
        },
      },
      { title: 'SQ1', dataIndex: 'Q1', key: 'Q1', width: 90 },
      { title: 'SQ2', dataIndex: 'Q2', key: 'Q2', width: 90 },
      { title: 'SQ3', dataIndex: 'Q3', key: 'Q3', width: 90 },
    ],
    [t, navigate],
  );

  // Sprint columns ----------------------------------------------------------
  const sprintColumns: ColumnsType<Result> = useMemo(
    () => [
      { title: t('rank'), dataIndex: 'position', key: 'position', width: 60 },
      { title: t('grid'), dataIndex: 'grid', key: 'grid', width: 60 },
      {
        title: t('driver'),
        key: 'driver',
        render: (_: unknown, record: Result) => {
          const color = getTeamColor(record.Constructor.constructorId);
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <DriverAvatar driverId={record.Driver.driverId} size={32} givenName={record.Driver.givenName} familyName={record.Driver.familyName} />
              <span
                onClick={() => navigate(`/drivers/${record.Driver.driverId}`)}
                style={{
                  display: 'inline-block',
                  backgroundColor: color,
                  color: LIGHT_TAG_COLORS.has(color) ? '#111827' : '#fff',
                  fontWeight: 700,
                  fontSize: 12,
                  padding: '2px 6px',
                  borderRadius: 3,
                  minWidth: 36,
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                {record.Driver.code}
              </span>
              <ConstructorLogo constructorId={record.Constructor.constructorId} size={24} />
              <span style={{ fontWeight: 500, fontSize: 13 }}>
                {record.Driver.givenName} {record.Driver.familyName}
              </span>
            </div>
          );
        },
      },
      { title: t('laps'), dataIndex: 'laps', key: 'laps', width: 60 },
      {
        title: t('result'),
        key: 'time',
        render: (_: unknown, record: Result) => record.Time?.time || record.status,
      },
      {
        title: t('points'),
        dataIndex: 'points',
        key: 'points',
        width: 60,
        render: (points: string) => <span className="points">{points}</span>,
      },
    ],
    [t, navigate],
  );

  // Practice columns --------------------------------------------------------
  const practiceColumns: ColumnsType<Result> = useMemo(
    () => [
      { title: t('rank'), dataIndex: 'position', key: 'position', width: 60 },
      {
        title: t('driver'),
        key: 'driver',
        render: (_: unknown, record: Result) => {
          const color = getTeamColor(record.Constructor.constructorId);
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <DriverAvatar driverId={record.Driver.driverId} size={32} givenName={record.Driver.givenName} familyName={record.Driver.familyName} />
              <span
                onClick={() => navigate(`/drivers/${record.Driver.driverId}`)}
                style={{
                  display: 'inline-block',
                  backgroundColor: color,
                  color: LIGHT_TAG_COLORS.has(color) ? '#111827' : '#fff',
                  fontWeight: 700,
                  fontSize: 12,
                  padding: '2px 6px',
                  borderRadius: 3,
                  minWidth: 36,
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                {record.Driver.code}
              </span>
              <ConstructorLogo constructorId={record.Constructor.constructorId} size={24} />
              <span style={{ fontWeight: 500, fontSize: 13 }}>
                {record.Driver.givenName} {record.Driver.familyName}
              </span>
            </div>
          );
        },
      },
      {
        title: t('result'),
        key: 'time',
        render: (_: unknown, record: Result) => record.Time?.time || record.status || '-',
      },
      { title: t('laps'), dataIndex: 'laps', key: 'laps', width: 60 },
    ],
    [t, navigate],
  );

  // Build tab items ---------------------------------------------------------
  const tabItems: TabItem[] = [
    ...([
      hasFp1 && {
        key: 'fp1',
        label: t('fp1'),
        data: fp1Results,
        columns: practiceColumns as unknown as ColumnsType<Result | QualifyingResult>,
      },
      hasFp2 && {
        key: 'fp2',
        label: t('fp2'),
        data: fp2Results,
        columns: practiceColumns as unknown as ColumnsType<Result | QualifyingResult>,
      },
      hasFp3 && {
        key: 'fp3',
        label: t('fp3'),
        data: fp3Results,
        columns: practiceColumns as unknown as ColumnsType<Result | QualifyingResult>,
      },
      hasSprintQualifying && {
        key: 'sprintQualifying',
        label: t('sprintQualifying'),
        data: sprintQualifyingResults,
        columns: sprintQualifyingColumns as unknown as ColumnsType<Result | QualifyingResult>,
      },
      hasSprint && {
        key: 'sprint',
        label: t('sprint'),
        data: sprintResults,
        columns: sprintColumns as unknown as ColumnsType<Result | QualifyingResult>,
      },
    ].filter(Boolean) as TabItem[]),
    {
      key: 'qualifying',
      label: t('qualifying'),
      data: qualifyingResults,
      columns: qualifyingColumns as unknown as ColumnsType<Result | QualifyingResult>,
    },
    {
      key: 'race',
      label: t('race'),
      data: raceResults,
      columns: raceColumns as unknown as ColumnsType<Result | QualifyingResult>,
    },
  ];

  const effectiveActiveTab =
    tabItems.find((item) => item.key === activeTab)?.key
    || tabItems.find((item) => item.key === 'race')?.key
    || tabItems[0]?.key
    || 'race';

  return (
    <div className="race-results-page">
      <RacePageIntro
        index="01"
        eyebrow="WEEKEND OVERVIEW / 赛事概览"
        title={raceResults.length ? '看懂方格旗之后的全部故事' : '从周末第一圈开始追踪局势'}
        description={raceResults.length
          ? '先读懂领奖台、位置变化与关键异常，再进入每一个场次的完整分类。'
          : '已发布的练习、排位与冲刺成绩会在这里持续汇总，正赛结束后自动生成赛后速览。'}
        aside={(
          <div className="race-page-pulse">
            <span><strong>{tabItems.length}</strong> 场次</span>
            <span><strong>{raceResults.length || qualifyingResults.length}</strong> 车手</span>
            <span><strong>{insights.interruptionCount}</strong> 中断阶段</span>
          </div>
        )}
      />

      <RaceOverviewPanel insights={insights} />

      <section className="race-classification-shell" aria-labelledby="race-classification-title">
        <div className="race-classification-heading">
          <div>
            <span>OFFICIAL CLASSIFICATION</span>
            <h2 id="race-classification-title">完整场次成绩</h2>
          </div>
          <p>切换场次查看官方分类；车手代码可直接进入车手档案。</p>
        </div>
        <Tabs
          className="race-session-tabs"
          activeKey={effectiveActiveTab}
          onChange={setActiveTab}
          items={tabItems.map((item) => ({
            key: item.key,
            label: (
              <span className="race-session-tab-label">
                <b>{SESSION_CODES[item.key] || item.key.toUpperCase()}</b>
                <span>{item.label}</span>
              </span>
            ),
            children: (
              <div className="race-classification-table">
                <Table
                  columns={item.columns}
                  dataSource={item.data}
                  rowKey={(record: Result | QualifyingResult) => record.Driver?.driverId || ''}
                  pagination={false}
                  loading={getTableLoading(item.key, item.data)}
                  locale={{ emptyText: renderEmptyState(item.key) }}
                  size="small"
                  scroll={{ x: 'max-content' }}
                />
              </div>
            ),
          }))}
        />
      </section>
    </div>
  );
};

export default RaceResults;
