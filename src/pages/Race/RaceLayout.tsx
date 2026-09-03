import { Suspense, useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from '@/i18n';
import { Button, Card, Tabs } from 'antd';
import {
  ArrowLeftOutlined,
  BarChartOutlined,
  CalendarOutlined,
  CompassOutlined,
  FlagOutlined,
  FundProjectionScreenOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { RaceDataProvider, useRaceData } from './RaceContext';
import { formatRaceDateTimeFull } from '@/utils/raceSchedule';
import { buildRaceOverviewInsights } from '@/utils/raceOverviewInsights';
import { getRaceRouteSection } from '@/utils/race/raceSessionState';
import { preloadRaceSectionRoute } from '@/utils/routePreload';
import { TimingBeacon } from '@/components/loading/TimingBeacon';
import '../RaceDetail.css';

const InnerLayout = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    season,
    round,
    raceInfo,
    seasonLoading,
    primaryLoading,
    raceLoadError,
    retryRaceData,
    availableDbSessions,
    sprintResults,
    raceResults,
    qualifyingResults,
    fastF1Analytics,
    fastF1QualifyingAnalytics,
    fastF1SprintQualifyingAnalytics,
    fastF1SprintShootoutAnalytics,
    fastF1SprintAnalytics,
    activeWeekendMode,
    sessionLoadErrors,
    retryActiveSession,
    diagnosticFlowId,
  } = useRaceData();

  const hasSprintQualifying = Boolean(raceInfo?.SprintQualifying)
    || Boolean(raceInfo?.isSprintWeekend)
    || availableDbSessions.includes('SQ')
    || availableDbSessions.includes('SS');
  const hasSprint = (sprintResults && sprintResults.length > 0)
    || Boolean(raceInfo?.Sprint)
    || Boolean(raceInfo?.isSprintWeekend)
    || availableDbSessions.includes('S');
  const isSprintWeekend = hasSprint || hasSprintQualifying;
  const routeTab = getRaceRouteSection(location.pathname);
  const hasActiveFastF1Analytics = routeTab === 'qualifying'
    ? Boolean(fastF1QualifyingAnalytics)
    : routeTab === 'sprint'
      ? Boolean(
        fastF1SprintAnalytics
        || fastF1SprintQualifyingAnalytics
        || fastF1SprintShootoutAnalytics,
      )
      : Boolean(fastF1Analytics);
  const activeSessionErrorKey = routeTab === 'qualifying' && sessionLoadErrors.sprintQualifying
    ? 'sprintQualifying'
    : routeTab;
  const insights = useMemo(
    () => buildRaceOverviewInsights(raceResults, qualifyingResults, fastF1Analytics),
    [fastF1Analytics, qualifyingResults, raceResults],
  );
  const tabLabel = (
    key: string,
    icon: JSX.Element,
    title: string,
    subtitle: string,
  ) => (
    <span
      className="race-command-tab-label"
      onPointerEnter={() => preloadRaceSectionRoute(key, season, round)}
      onPointerDown={() => preloadRaceSectionRoute(key, season, round)}
    >
      {icon}<span><strong>{title}</strong><small>{subtitle}</small></span>
    </span>
  );

  if ((seasonLoading || primaryLoading) && !raceInfo) {
    return (
      <div className="race-detail-page race-layout-progressive">
        <div className="race-layout-skeleton" role="status" aria-label={t('loading')}>
          <div className="race-skeleton-line" />
          <div className="race-skeleton-hero" />
          <div className="race-skeleton-tabs" />
        </div>
        <Suspense fallback={<TimingBeacon label="Switching session view" detail="Loading the requested race module" />}>
          <Outlet />
        </Suspense>
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
          <small>{`诊断编号: ${diagnosticFlowId}`}</small>
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
      <section className="race-command" aria-labelledby="race-command-title">
        <span className="race-command-round-mark" aria-hidden="true">
          {String(raceInfo.round).padStart(2, '0')}
        </span>
        <div className="race-command-grid" aria-hidden="true" />

        <div className="race-command-utility">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(-1)}
            className="race-command-back"
          >
            返回赛历
          </Button>
          <span className="race-command-championship">
            FIA FORMULA ONE WORLD CHAMPIONSHIP
          </span>
          <span className={`race-command-state state-${activeWeekendMode}`}>
            <i />
            {activeWeekendMode === 'post' ? 'FINAL · 已完赛' : 'UPCOMING · 赛前'}
          </span>
        </div>

        <div className="race-command-main">
          <div className="race-command-copy">
            <span className="race-command-kicker">
              {raceInfo.season} SEASON / ROUND {String(raceInfo.round).padStart(2, '0')}
            </span>
            <h1 id="race-command-title">
              <FlagOutlined />
              <span>{raceInfo.raceName}</span>
            </h1>
            <p>
              <strong>{raceInfo.Circuit.circuitName}</strong>
              <span>{raceInfo.Circuit.Location.locality} · {raceInfo.Circuit.Location.country}</span>
            </p>
            <div className="race-command-meta">
              <span><CalendarOutlined />{formatRaceDateTimeFull(raceInfo)}</span>
              {isSprintWeekend ? <span className="is-sprint"><ThunderboltOutlined />SPRINT WEEKEND</span> : null}
            </div>
          </div>

          <div className="race-command-snapshot" aria-label="比赛关键数据">
            <div className="race-command-stat is-primary">
              <span>{insights.winner ? 'RACE WINNER' : 'RACE STATUS'}</span>
              <strong>{insights.winner?.Driver.code || 'PENDING'}</strong>
              <small>{insights.winner ? insights.winner.Constructor.name : '等待比赛结果'}</small>
            </div>
            <div className="race-command-stat">
              <span>POLE POSITION</span>
              <strong>{insights.pole?.Driver.code || '—'}</strong>
              <small>{insights.pole?.Constructor.name || '排位结果待发布'}</small>
            </div>
            <div className="race-command-stat">
              <span>FASTEST LAP</span>
              <strong>{insights.fastestLap?.result.Driver.code || '—'}</strong>
              <small>{insights.fastestLap?.time || `${insights.totalLaps || '—'} LAPS`}</small>
            </div>
          </div>
        </div>

        <div className="race-command-footer">
          <span><i className="signal-dot" /> RACE DATA LINK</span>
          <span>{raceResults.length || qualifyingResults.length ? 'CLASSIFICATION AVAILABLE' : 'AWAITING SESSION DATA'}</span>
          <span>{hasActiveFastF1Analytics ? 'FASTF1 ANALYTICS ONLINE' : 'FASTF1 ANALYTICS STANDBY'}</span>
        </div>
      </section>

      {raceLoadError ? (
        <div className="race-partial-notice" role="status">
          <span>{'\u90e8\u5206\u8d5b\u4e8b\u6570\u636e\u6682\u65f6\u65e0\u6cd5\u66f4\u65b0\uff0c\u5df2\u52a0\u8f7d\u7684\u5185\u5bb9\u4ecd\u53ef\u67e5\u770b\u3002'}</span>
          <Button size="large" onClick={retryRaceData}>{'\u91cd\u8bd5'}</Button>
          <small>{`诊断编号: ${diagnosticFlowId}`}</small>
        </div>
      ) : null}
      {sessionLoadErrors[activeSessionErrorKey] ? (
        <div className="race-partial-notice" role="alert">
          <span>{sessionLoadErrors[activeSessionErrorKey]}，请重试以获取完整结果。</span>
          <Button onClick={retryActiveSession}>重试此场次</Button>
        </div>
      ) : null}
      {sessionLoadErrors.discovery ? (
        <div className="race-partial-notice" role="status">
          <span>{sessionLoadErrors.discovery}，已按官方赛程显示可用场次。</span>
          <Button onClick={retryActiveSession}>重新发现场次</Button>
        </div>
      ) : null}

      <Tabs
        className="race-subpage-tabs"
        activeKey={routeTab}
        onChange={(key) => {
          navigate(`/races/${raceInfo.round}/${key}${location.search}`, { replace: true });
        }}
        items={[
          {
            key: 'results',
            label: tabLabel('results', <TrophyOutlined />, '赛事概览', 'OVERVIEW'),
          },
          {
            key: 'qualifying',
            label: tabLabel('qualifying', <BarChartOutlined />, '排位解构', 'QUALIFYING'),
          },
          {
            key: 'race',
            label: tabLabel('race', <FundProjectionScreenOutlined />, '比赛解读', 'RACE ANALYSIS'),
          },
          ...(hasSprint ? [{
            key: 'sprint' as const,
            label: tabLabel('sprint', <ThunderboltOutlined />, '冲刺周末', 'SPRINT'),
          }] : []),
          {
            key: 'info',
            label: tabLabel('info', <CompassOutlined />, '周末情报', 'INTELLIGENCE'),
          },
        ]}
      />

      <Suspense fallback={<TimingBeacon label="Switching session view" detail="Keeping loaded race data in place" />}>
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
