import { Suspense, useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from '@/i18n';
import { Button, Card, Tabs } from 'antd';
import {
  ArrowLeftOutlined,
  BarChartOutlined,
  CalendarOutlined,
  CompassOutlined,
  FundProjectionScreenOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { RaceDataProvider, useRaceData } from './RaceContext';
import { useRaceSchedule } from '@/hooks/useRaceSchedule';
import { buildRaceOverviewInsights } from '@/utils/raceOverviewInsights';
import { getRaceRouteSection } from '@/utils/race/raceSessionState';
import { preloadRaceSectionRoute } from '@/utils/routePreload';
import { TimingBeacon } from '@/components/loading/TimingBeacon';
import '../RaceDetail.css';

const InnerLayout = () => {
  const { t } = useTranslation();
  const { formatRaceDateTimeFull } = useRaceSchedule();
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
        <div className="race-command-utility">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(-1)}
            className="race-command-back"
          >
            返回赛历
          </Button>
          <span className={`race-command-state state-${activeWeekendMode}`}>
            <i />
            {activeWeekendMode === 'post' ? '已完赛' : '赛前'}
          </span>
        </div>

        <div className="race-command-main">
          <div className="race-command-copy">
            <span className="race-command-kicker">
              {raceInfo.season} 赛季 · 第 {raceInfo.round} 站
            </span>
            <h1 id="race-command-title">
              <span>{raceInfo.raceName}</span>
            </h1>
            <p>
              <strong>{raceInfo.Circuit.circuitName}</strong>
              <span>{raceInfo.Circuit.Location.locality} · {raceInfo.Circuit.Location.country}</span>
            </p>
            {isSprintWeekend ? <span className="race-command-sprint"><ThunderboltOutlined />冲刺周末</span> : null}
          </div>

          <div className="race-command-start" aria-label="正赛时间">
            <span><CalendarOutlined />正赛时间</span>
            <strong>{formatRaceDateTimeFull(raceInfo)}</strong>
          </div>
        </div>

        {insights.winner || insights.pole || insights.fastestLap ? (
          <div className="race-command-snapshot" aria-label="比赛关键数据">
            {insights.winner ? (
              <div className="race-command-stat is-primary">
                <span>冠军</span>
                <strong>{insights.winner.Driver.givenName} {insights.winner.Driver.familyName}</strong>
              </div>
            ) : null}
            {insights.pole ? (
              <div className="race-command-stat">
                <span>杆位</span>
                <strong>{insights.pole.Driver.givenName} {insights.pole.Driver.familyName}</strong>
              </div>
            ) : null}
            {insights.fastestLap ? (
              <div className="race-command-stat">
                <span>最快圈 · {insights.fastestLap.time}</span>
                <strong>{insights.fastestLap.result.Driver.givenName} {insights.fastestLap.result.Driver.familyName}</strong>
              </div>
            ) : null}
          </div>
        ) : null}
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
