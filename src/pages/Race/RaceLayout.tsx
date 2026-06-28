import { Suspense } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Card, Tabs } from 'antd';
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  FlagOutlined,
} from '@ant-design/icons';
import { RaceDataProvider, useRaceData } from './RaceContext';
import { formatRaceDateTimeFull, formatSessionDateTime, getRaceWeekendSchedule, type RaceWeekendSession } from '@/utils/raceSchedule';
import { TEXT } from '@/pages/Race/shared/constants';

const InnerLayout = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { raceInfo, seasonLoading, primaryLoading, availableDbSessions, sprintResults, setActiveTab } = useRaceData();

  const weekendSchedule = getRaceWeekendSchedule(raceInfo, TEXT);

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
          {weekendSchedule.length ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 0,
              padding: '16px 0 8px',
              overflowX: 'auto',
            }}>
              {weekendSchedule.map((item, index) => {
                const tones: Record<RaceWeekendSession['tone'], { bg: string; border: string; text: string }> = {
                  practice: { bg: 'var(--schedule-practice-bg, #f8fafc)', border: 'var(--schedule-practice-border, #94a3b8)', text: 'var(--schedule-practice-text, #475569)' },
                  qualifying: { bg: 'var(--schedule-qualifying-bg, #fefce8)', border: 'var(--schedule-qualifying-border, #eab308)', text: 'var(--schedule-qualifying-text, #854d0e)' },
                  sprint: { bg: 'var(--schedule-sprint-bg, #fef2f2)', border: 'var(--schedule-sprint-border, #ef4444)', text: 'var(--schedule-sprint-text, #991b1b)' },
                  race: { bg: 'var(--schedule-race-bg, #fef2f2)', border: 'var(--schedule-race-border, #dc2626)', text: 'var(--schedule-race-text, #7f1d1d)' },
                };
                const tone = tones[item.tone];
                const timeLabel = formatSessionDateTime(item.session);

                return (
                  <div key={item.key} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    {index > 0 && (
                      <div style={{
                        width: 24,
                        height: 2,
                        background: 'linear-gradient(90deg, #e2e8f0, #cbd5e1)',
                        margin: '0 4px',
                        flexShrink: 0,
                      }} />
                    )}
                    <div style={{
                      background: tone.bg,
                      border: `1.5px solid ${tone.border}`,
                      borderRadius: 8,
                      padding: '8px 12px',
                      textAlign: 'center',
                      minWidth: 90,
                      flexShrink: 0,
                    }}>
                      <div style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: tone.text,
                        letterSpacing: 0.5,
                        marginBottom: 2,
                      }}>
                        {item.code}
                      </div>
                      <div style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#1e293b',
                        marginBottom: 2,
                      }}>
                        {item.label}
                      </div>
                      <div style={{
                        fontSize: 10,
                        color: '#94a3b8',
                      }}>
                        {timeLabel}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </Card>

      <Tabs
        className="race-subpage-tabs"
        defaultActiveKey="results"
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
