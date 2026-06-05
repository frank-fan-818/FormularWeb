import { Suspense } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Card, Tabs } from 'antd';
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  FlagOutlined,
} from '@ant-design/icons';
import { RaceDataProvider, useRaceData } from './RaceContext';
import { formatRaceDateTimeFull, getRaceWeekendSchedule, getRaceWeekendScheduleGroups } from '@/utils/raceSchedule';
import { TEXT } from '@/pages/Race/shared/constants';

const InnerLayout = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { raceInfo, seasonLoading, primaryLoading, availableDbSessions, sprintResults } = useRaceData();

  const weekendSchedule = getRaceWeekendSchedule(raceInfo, TEXT);
  const weekendScheduleGroups = getRaceWeekendScheduleGroups(weekendSchedule);

  const hasSprintQualifying = Boolean(raceInfo?.SprintQualifying) || availableDbSessions.includes('SQ') || availableDbSessions.includes('SS');
  const hasSprint = (sprintResults && sprintResults.length > 0) || Boolean(raceInfo?.Sprint) || availableDbSessions.includes('S');
  const isSprintWeekend = hasSprint || hasSprintQualifying;

  if ((seasonLoading || primaryLoading) && !raceInfo) {
    return <div>{t('loading')}</div>;
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
          {weekendScheduleGroups.length ? (
            <div className="weekend-schedule" aria-label={t('weekendSchedule')}>
              <div className="weekend-schedule-topbar">
                <div>
                  <span className="weekend-schedule-eyebrow">{t('weekendSchedule')}</span>
                  <span className="weekend-schedule-source">{t('scheduleSourceHint')}</span>
                </div>
                <span className="weekend-time-toggle" aria-label={`${t('scheduleTimezone')} ${t('scheduleTimezoneValue')}`}>
                  <ClockCircleOutlined />
                  <strong>{t('scheduleTimezone')}</strong>
                  {t('scheduleTimezoneValue')}
                </span>
              </div>
              <div className="weekend-schedule-days">
                {weekendScheduleGroups.map((group) => (
                  <section key={group.key} className="weekend-schedule-day">
                    <div className="weekend-day-header">
                      <span className="weekend-day-name">{group.dayLabel}</span>
                      <span className="weekend-day-date">
                        <CalendarOutlined />
                        {group.dateLabel}
                      </span>
                    </div>
                    <div className="weekend-session-list">
                      {group.sessions.map((item) => (
                        <div key={item.key} className={`weekend-session weekend-session-${item.tone}`}>
                          <span className="weekend-session-code">{item.code}</span>
                          <span className="weekend-session-main">
                            <strong>{item.label}</strong>
                            <span>{t('scheduleTimezoneValue')}</span>
                          </span>
                          <time className="weekend-session-time">{item.timeLabel}</time>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      <Tabs
        className="race-subpage-tabs"
        defaultActiveKey="results"
        onChange={(key) => {
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

      <Suspense
        fallback={(
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              padding: '64px 24px',
            }}
          >
            <div
              aria-label="loading"
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: '2px solid rgba(15, 23, 42, 0.16)',
                borderTopColor: 'var(--f1-red, #ff1801)',
                animation: 'route-spin 0.8s linear infinite',
              }}
            />
          </div>
        )}
      >
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
