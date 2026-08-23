import { Card, Descriptions, Tag } from 'antd';
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
    <div className="race-info-overview">
      <Card
        className="race-weekend-card race-info-circuit-card"
        title={<div className="data-view-title"><span>赛道特性</span></div>}
      >
        <Descriptions column={1} size="small" colon={false}>
          <Descriptions.Item label={<span style={{ fontWeight: 600 }}>{RACE_INFO_TEXT.direction}</span>}>
            {circuitEnhancement.direction
              ? formatCircuitDirection(circuitEnhancement.direction)
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label={<span style={{ fontWeight: 600 }}>{RACE_INFO_TEXT.turns}</span>}>
            {circuitEnhancement.leftTurns !== undefined && circuitEnhancement.rightTurns !== undefined
              ? `${circuitEnhancement.leftTurns}L / ${circuitEnhancement.rightTurns}R`
              : '-'}
          </Descriptions.Item>
          {isSprintWeekend ? (
            <Descriptions.Item label={<span style={{ fontWeight: 600 }}>{t('sprintWeekend')}</span>}>
              <Tag color="red" style={{ fontWeight: 700 }}>{t('sprintWeekend')}</Tag>
            </Descriptions.Item>
          ) : null}
        </Descriptions>
      </Card>

      <Card
        className="race-weekend-card race-info-schedule-card"
        title={<div className="data-view-title"><span>{t('weekendSchedule')}</span></div>}
      >
        {scheduleGroups.length ? (
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
      </Card>
    </div>
  );
}
