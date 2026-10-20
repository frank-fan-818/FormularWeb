import { useMemo } from 'react';
import { useAppStore } from '@/store';
import * as schedule from '@/utils/raceSchedule';
import { formatUtcOffset } from '@/utils/timeZone';

export function useRaceSchedule() {
  const offset = useAppStore(state => state.timeZoneOffsetMinutes);

  return useMemo(() => ({
    timeZoneLabel: formatUtcOffset(offset),
    formatRaceDateTime: (race: Parameters<typeof schedule.formatRaceDateTime>[0]) => schedule.formatRaceDateTime(race, offset),
    formatRaceDateTimeFull: (race: Parameters<typeof schedule.formatRaceDateTimeFull>[0]) => schedule.formatRaceDateTimeFull(race, offset),
    formatSessionDateTime: (session: Parameters<typeof schedule.formatSessionDateTime>[0]) => schedule.formatSessionDateTime(session, offset),
    formatSessionDateLabel: (session: Parameters<typeof schedule.formatSessionDateLabel>[0]) => schedule.formatSessionDateLabel(session, offset),
    getRaceWeekendTimeline: (
      race: Parameters<typeof schedule.getRaceWeekendTimeline>[0],
      labels: Parameters<typeof schedule.getRaceWeekendTimeline>[1],
      now?: Date,
    ) => schedule.getRaceWeekendTimeline(race, labels, now, offset),
    getRaceWeekendScheduleGroups: (sessions: schedule.RaceWeekendTimelineItem[]) => schedule.getRaceWeekendScheduleGroups(sessions, offset),
  }), [offset]);
}
