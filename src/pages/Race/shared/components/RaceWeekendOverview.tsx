import { Tag } from 'antd';
import { CalendarOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useTranslation } from '@/i18n';
import type { getCircuitEnhancement } from '@/utils/circuitEnhancements';
import { formatCircuitDirection } from '@/utils/circuitEnhancements';
import type { getRaceWeekendScheduleGroups } from '@/utils/raceSchedule';
import { RACE_INFO_TEXT } from '@/pages/Race/shared/raceInfoConstants';

interface RaceWeekendOverviewProps {
  circuitEnhancement: ReturnType<typeof getCircuitEnhancement>;
  scheduleGroups: ReturnType<typeof getRaceWeekendScheduleGroups>;
  isSprintWeekend: boolean;
  resultSessionKeys: string[];
}

export function RaceWeekendOverview({
  circuitEnhancement,
  scheduleGroups,
  isSprintWeekend,
  resultSessionKeys,
}: RaceWeekendOverviewProps) {
  const { t } = useTranslation();
  return (
    <section className="weekend-brief" aria-label={t('weekendSchedule')}>
        {scheduleGroups.length ? (
          <div className="weekend-schedule">
            <div className="weekend-schedule-topbar">
              <div>
                <h3 className="weekend-schedule-eyebrow">{t('weekendSchedule')}</h3>
                <span className="weekend-schedule-source">{t('scheduleSourceHint')}</span>
              </div>
              <span className="weekend-time-toggle" aria-label={`${t('scheduleTimezone')} ${t('scheduleTimezoneValue')}`}>
                <ClockCircleOutlined />
                <strong>{t('scheduleTimezone')}</strong>
                {t('scheduleTimezoneValue')}
              </span>
            </div>
            <div className="weekend-schedule-days">
              {scheduleGroups.map((group) => (
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
                      <div key={item.key} className={`weekend-session weekend-session-${item.tone} is-${item.state} ${item.isNext ? 'is-next' : ''}`}>
                        <span className="weekend-session-code">{item.code}</span>
                        <span className="weekend-session-main">
                          <strong>{item.label}</strong>
                          <span>
                            {resultSessionKeys.includes(item.key)
                              ? '结果已收录'
                              : item.state === 'live'
                                ? '进行中'
                                : item.state === 'completed'
                                  ? '已结束'
                                  : item.isNext ? '下一场' : '未开始'}
                          </span>
                        </span>
                        <time className="weekend-session-time">{item.timeLabel}</time>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        ) : (
          <div className="race-weekend-empty">{t('noPreviewData')}</div>
        )}
      <div className="weekend-circuit-strip">
        <span className="weekend-circuit-label">赛道特性</span>
        <dl>
          <div><dt>{RACE_INFO_TEXT.direction}</dt><dd>{circuitEnhancement.direction ? formatCircuitDirection(circuitEnhancement.direction) : '-'}</dd></div>
          <div><dt>{RACE_INFO_TEXT.turns}</dt><dd>{circuitEnhancement.leftTurns !== undefined && circuitEnhancement.rightTurns !== undefined ? `${circuitEnhancement.leftTurns}L / ${circuitEnhancement.rightTurns}R` : '-'}</dd></div>
        </dl>
        {isSprintWeekend ? <Tag color="red">{t('sprintWeekend')}</Tag> : null}
      </div>
    </section>
  );
}
