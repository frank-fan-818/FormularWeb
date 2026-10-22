import { Tag } from 'antd';
import { useTranslation } from '@/i18n';
import { useRaceSchedule } from '@/hooks/useRaceSchedule';
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
  const { timeZoneLabel, formatSessionDateLabel } = useRaceSchedule();
  const sessions = scheduleGroups.flatMap((group) => group.sessions);
  return (
    <section className="weekend-brief" aria-label={t('weekendSchedule')}>
        {sessions.length ? (
          <div className="compact-weekend-schedule">
            <div className="compact-weekend-heading">
              <h3>{t('weekendSchedule')}</h3>
              <span className="weekend-time-toggle" aria-label={`${t('scheduleTimezone')} ${timeZoneLabel}`}>
                {timeZoneLabel}
              </span>
            </div>
            <div className="compact-weekend-sessions">
              {sessions.map((item) => (
                <div key={item.key} className={`compact-weekend-session is-${item.state} ${item.isNext ? 'is-next' : ''}`}>
                  <div className="compact-weekend-session-heading">
                    <strong>{item.label}</strong>
                    {resultSessionKeys.includes(item.key) || item.state === 'live' || item.state === 'completed' || item.isNext ? (
                      <small>
                        {resultSessionKeys.includes(item.key)
                          ? '结果已收录'
                          : item.state === 'live'
                            ? '进行中'
                            : item.state === 'completed'
                              ? '已结束'
                              : '下一场'}
                      </small>
                    ) : null}
                  </div>
                  <div className="compact-weekend-session-start">
                    <span className="compact-weekend-session-date">{formatSessionDateLabel(item.session ?? {})}</span>
                    <time className="weekend-session-time" dateTime={item.session?.date && item.session.time ? `${item.session.date}T${item.session.time}` : undefined}>{item.timeLabel}</time>
                  </div>
                </div>
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
