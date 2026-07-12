import { Suspense, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Card, Tabs } from 'antd';
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  FlagOutlined,
} from '@ant-design/icons';
import { RaceDataProvider, useRaceData } from './RaceContext';
import { formatRaceDateTimeFull } from '@/utils/raceSchedule';
import '../RaceDetail.css';

const RACE_TAB_KEYS = ['results', 'qualifying', 'race', 'sprint', 'info'] as const;

const InnerLayout = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    raceInfo,
    seasonLoading,
    primaryLoading,
    raceLoadError,
    retryRaceData,
    availableDbSessions,
    sprintResults,
    sessionLoadErrors,
    retryActiveSession,
    setActiveTab,
  } = useRaceData();

  const hasSprintQualifying = Boolean(raceInfo?.SprintQualifying) || availableDbSessions.includes('SQ') || availableDbSessions.includes('SS');
  const hasSprint = (sprintResults && sprintResults.length > 0) || Boolean(raceInfo?.Sprint) || availableDbSessions.includes('S');
  const isSprintWeekend = hasSprint || hasSprintQualifying;
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const requestedTab = pathSegments[pathSegments.length - 1] || 'results';
  const routeTab = RACE_TAB_KEYS.includes(requestedTab as typeof RACE_TAB_KEYS[number])
    ? requestedTab
    : 'results';

  useEffect(() => {
    setActiveTab(routeTab);
  }, [routeTab, setActiveTab]);

  if ((seasonLoading || primaryLoading) && !raceInfo) {
    return (
      <div className="race-detail-page race-layout-skeleton" role="status" aria-label={t('loading')}>
        <div className="race-skeleton-line" />
        <div className="race-skeleton-hero" />
        <div className="race-skeleton-tabs" />
      </div>
    );
  }

  if (raceLoadError && !raceInfo) {
    return (
      <div className="race-detail-page">
        <div className="race-load-error" role="alert">
          <strong>{'\u8d5b\u4e8b\u6570\u636e\u6682\u65f6\u65e0\u6cd5\u52a0\u8f7d'}</strong>
          <span>{'\u8bf7\u68c0\u67e5\u7f51\u7edc\u540e\u91cd\u8bd5\uff0c\u5df2\u7f13\u5b58\u6570\u636e\u4e0d\u4f1a\u88ab\u8986\u76d6\u3002'}</span>
          <Button type="primary" onClick={retryRaceData}>{'\u91cd\u8bd5'}</Button>
        </div>
      </div>
    );
  }

  if (!raceInfo) {
    return (
      <div className="race-detail-page">
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(-1)}
          className="back-button"
        >
          {t('back')}
        </Button>
        <Card>
          <p>{t('notFound')}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="race-detail-page">
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(-1)}
        className="back-button"
      >
        {t('back')}
      </Button>

      <Card loading={seasonLoading || primaryLoading} className="race-info-card">
        <div className="race-hero">
          <div className="race-hero-top">
            <h1 className="race-hero-title">
              <FlagOutlined className="race-hero-flag" />
              <span>{raceInfo.raceName}</span>
            </h1>
            <div className="race-hero-badges">
              <span className="race-hero-date">
                <CalendarOutlined />
                {formatRaceDateTimeFull(raceInfo)}
              </span>
              {isSprintWeekend ? (
                <span className="race-hero-sprint">
                  {t('sprintWeekend')}
                </span>
              ) : null}
            </div>
          </div>
          <p className="race-hero-circuit">
            {raceInfo.Circuit.circuitName}
            <span> — {raceInfo.Circuit.Location.locality}, {raceInfo.Circuit.Location.country}</span>
          </p>
        </div>
      </Card>

      {raceLoadError ? (
        <div className="race-partial-notice" role="status">
          <span>{'\u90e8\u5206\u8d5b\u4e8b\u6570\u636e\u6682\u65f6\u65e0\u6cd5\u66f4\u65b0\uff0c\u5df2\u52a0\u8f7d\u7684\u5185\u5bb9\u4ecd\u53ef\u67e5\u770b\u3002'}</span>
          <Button size="large" onClick={retryRaceData}>{'\u91cd\u8bd5'}</Button>
        </div>
      ) : null}
      {sessionLoadErrors[routeTab] ? (
        <div className="race-partial-notice" role="alert">
          <span>{sessionLoadErrors[routeTab]}，请重试以获取完整结果。</span>
          <Button onClick={retryActiveSession}>重试此场次</Button>
        </div>
      ) : null}

      <Tabs
        className="race-subpage-tabs"
        activeKey={routeTab}
        onChange={(key) => {
          setActiveTab(key);
          navigate(`/races/${raceInfo.round}/${key}`, { replace: true });
        }}
        items={[
          {
            key: 'results',
            label: '比赛成绩',
          },
          {
            key: 'qualifying',
            label: '排位分析',
          },
          {
            key: 'race',
            label: '正赛分析',
          },
          ...(hasSprint ? [{ key: 'sprint' as const, label: '冲刺赛' }] : []),
          {
            key: 'info',
            label: '赛事信息',
          },
        ]}
      />

      <Suspense fallback={<div className="race-route-skeleton" role="status" aria-live="polite" aria-label={t('loading')}><span /><span /><span /></div>}>
        <Outlet />
      </Suspense>
    </div>
  );
};

const RaceLayout = () => {
  return (
    <RaceDataProvider>
      <InnerLayout />
    </RaceDataProvider>
  );
};

export default RaceLayout;
