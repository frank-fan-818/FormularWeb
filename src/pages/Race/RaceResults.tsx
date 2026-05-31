import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Table, Tabs } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { QualifyingResult, Result } from '@/types';
import { getTeamColor } from '@/utils/teamColors';
import { LIGHT_TAG_COLORS, DEFERRED_TAB_KEYS } from '@/pages/RaceDetail/constants';
import { useRaceData } from './RaceContext';
import '../RaceDetail.css';

interface TabItem {
  key: string;
  label: string;
  data: (Result | QualifyingResult)[];
  columns: ColumnsType<Result | QualifyingResult>;
}

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
    activeTab,
    setActiveTab,
  } = useRaceData();

  const hasFp1 =
    Boolean(raceInfo?.FirstPractice) || availableDbSessions.includes('FP1') || fp1Results.length > 0;
  const hasFp2 =
    Boolean(raceInfo?.SecondPractice) || availableDbSessions.includes('FP2') || fp2Results.length > 0;
  const hasFp3 =
    Boolean(raceInfo?.ThirdPractice) || availableDbSessions.includes('FP3') || fp3Results.length > 0;
  const hasSprintQualifying = sprintQualifyingResults.length > 0;
  const hasSprint = sprintResults.length > 0;

  const getTableLoading = (tabKey: string, data: unknown[]): boolean => {
    if (primaryLoading) return true;
    return DEFERRED_TAB_KEYS.includes(tabKey) && loadingSessionTabs.includes(tabKey) && data.length === 0;
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
              <span style={{ color: '#94a3b8', fontSize: 12 }}>{record.Constructor.name}</span>
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
              <span style={{ color: '#94a3b8', fontSize: 12 }}>{record.Constructor.name}</span>
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
              <span style={{ color: '#94a3b8', fontSize: 12 }}>{record.Constructor.name}</span>
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
      {
        title: t('driver'),
        key: 'driver',
        render: (_: unknown, record: Result) => {
          const color = getTeamColor(record.Constructor.constructorId);
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
              <span style={{ color: '#94a3b8', fontSize: 12 }}>{record.Constructor.name}</span>
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
              <span style={{ color: '#94a3b8', fontSize: 12 }}>{record.Constructor.name}</span>
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
    tabItems.find((item) => item.key === activeTab)?.key || tabItems[0]?.key || 'race';

  return (
    <div className="race-results-page">
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
              rowKey={(record: Result | QualifyingResult) => record.Driver?.driverId || ''}
              pagination={false}
              loading={getTableLoading(item.key, item.data)}
              size="small"
              scroll={{ x: 'max-content' }}
            />
          ),
        }))}
      />
    </div>
  );
};

export default RaceResults;
