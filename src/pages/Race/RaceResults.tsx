import { useMemo } from 'react';
import { useTranslation } from '@/i18n';
import { Button, Empty, Table, Tabs } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { QualifyingResult, RaceClassificationSessionKey, Result } from '@/types';
import { DEFERRED_TAB_KEYS } from '@/pages/Race/shared/constants';
import { RaceOverviewPanel } from '@/pages/Race/shared/components/RaceOverviewPanel';
import { RacePageIntro } from '@/pages/Race/shared/components/RacePageIntro';
import { SessionDriverCell } from '@/pages/Race/shared/components/SessionDriverCell';
import { buildRaceOverviewInsights } from '@/utils/raceOverviewInsights';
import { useRaceData } from './RaceContext';

interface TabItem {
  key: RaceClassificationSessionKey;
  label: string;
  data: (Result | QualifyingResult)[];
  columns: ColumnsType<Result | QualifyingResult>;
}

const SESSION_CODES: Record<RaceClassificationSessionKey, string> = {
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
    activeSessionTab,
    setActiveSessionTab,
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
        render: (_: unknown, record: Result) => (
          <SessionDriverCell driver={record.Driver} constructor={record.Constructor} />
        ),
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
  }, [raceResults, t]);

  // Qualifying columns ------------------------------------------------------
  const qualifyingColumns: ColumnsType<QualifyingResult> = useMemo(
    () => [
      { title: t('rank'), dataIndex: 'position', key: 'position', width: 60 },
      {
        title: t('driver'),
        key: 'driver',
        render: (_: unknown, record: QualifyingResult) => (
          <SessionDriverCell driver={record.Driver} constructor={record.Constructor} />
        ),
      },
      { title: 'Q1', dataIndex: 'Q1', key: 'Q1', width: 90 },
      { title: 'Q2', dataIndex: 'Q2', key: 'Q2', width: 90 },
      { title: 'Q3', dataIndex: 'Q3', key: 'Q3', width: 90 },
    ],
    [t],
  );

  // Sprint Qualifying columns -----------------------------------------------
  const sprintQualifyingColumns: ColumnsType<QualifyingResult> = useMemo(
    () => [
      { title: t('rank'), dataIndex: 'position', key: 'position', width: 60 },
      {
        title: t('driver'),
        key: 'driver',
        render: (_: unknown, record: QualifyingResult) => (
          <SessionDriverCell driver={record.Driver} constructor={record.Constructor} />
        ),
      },
      { title: 'SQ1', dataIndex: 'Q1', key: 'Q1', width: 90 },
      { title: 'SQ2', dataIndex: 'Q2', key: 'Q2', width: 90 },
      { title: 'SQ3', dataIndex: 'Q3', key: 'Q3', width: 90 },
    ],
    [t],
  );

  // Sprint columns ----------------------------------------------------------
  const sprintColumns: ColumnsType<Result> = useMemo(
    () => [
      { title: t('rank'), dataIndex: 'position', key: 'position', width: 60 },
      { title: t('grid'), dataIndex: 'grid', key: 'grid', width: 60 },
      {
        title: t('driver'),
        key: 'driver',
        render: (_: unknown, record: Result) => (
          <SessionDriverCell driver={record.Driver} constructor={record.Constructor} />
        ),
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
    [t],
  );

  // Practice columns --------------------------------------------------------
  const practiceColumns: ColumnsType<Result> = useMemo(
    () => [
      { title: t('rank'), dataIndex: 'position', key: 'position', width: 60 },
      {
        title: t('driver'),
        key: 'driver',
        render: (_: unknown, record: Result) => (
          <SessionDriverCell driver={record.Driver} constructor={record.Constructor} />
        ),
      },
      {
        title: t('result'),
        key: 'time',
        render: (_: unknown, record: Result) => record.Time?.time || record.status || '-',
      },
      { title: t('laps'), dataIndex: 'laps', key: 'laps', width: 60 },
    ],
    [t],
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
    tabItems.find((item) => item.key === activeSessionTab)?.key
    || tabItems.find((item) => item.key === 'race')?.key
    || tabItems[0]?.key
    || 'race';

  return (
    <div className="race-results-page">
      <RacePageIntro
        index="01"
        eyebrow="WEEKEND OVERVIEW / 赛事概览"
        title="赛事结果"
        description={raceResults.length
          ? undefined
          : '已发布的练习、排位与冲刺成绩会在这里汇总。'}
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
        </div>
        <Tabs
          className="race-session-tabs"
          activeKey={effectiveActiveTab}
          onChange={(key) => setActiveSessionTab(key as RaceClassificationSessionKey)}
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
