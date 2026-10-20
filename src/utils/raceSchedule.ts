import type { Race } from '@/types';
import { formatDateOnly } from '@/utils/dateTime';
import { DEFAULT_TIME_ZONE_OFFSET, formatUtcOffset, normalizeTimeZoneOffset } from '@/utils/timeZone';

export interface RaceWeekendSession {
  key: string;
  label: string;
  code: string;
  tone: 'practice' | 'qualifying' | 'sprint' | 'race';
  session?: {
    date?: string;
    time?: string;
  };
}

export interface RaceWeekendScheduleGroup {
  key: string;
  dayLabel: string;
  dateLabel: string;
  sessions: RaceWeekendTimelineItem[];
}

export interface RaceWeekendTimelineItem extends RaceWeekendSession {
  timestamp: number | null;
  timeLabel: string;
  state: 'completed' | 'live' | 'upcoming' | 'scheduled';
  isNext: boolean;
}

function getDisplayDate(timestamp: number, offsetMinutes: number): Date {
  return new Date(timestamp + normalizeTimeZoneOffset(offsetMinutes) * 60_000);
}

export function getSessionTimestamp(session: { date?: string; time?: string } | null | undefined): number | null {
  if (!session?.date || !session.time) {
    return null;
  }

  const normalizedTime = session.time.trim().endsWith('Z') ? session.time.trim() : `${session.time.trim()}Z`;
  const timestamp = Date.parse(`${session.date}T${normalizedTime}`);

  return Number.isNaN(timestamp) ? null : timestamp;
}

const SESSION_ACTIVE_WINDOW_MS = 3 * 60 * 60 * 1000;

export function getRaceWeekendTimeline(
  race: Race | null,
  labels: Parameters<typeof getRaceWeekendSchedule>[1],
  now = new Date(),
  offsetMinutes = DEFAULT_TIME_ZONE_OFFSET,
): RaceWeekendTimelineItem[] {
  const nowTime = now.getTime();
  const baseItems = getRaceWeekendSchedule(race, labels).map((item) => {
    const timestamp = getSessionTimestamp(item.session);
    let state: RaceWeekendTimelineItem['state'] = 'scheduled';
    if (timestamp !== null) {
      if (nowTime >= timestamp && nowTime < timestamp + SESSION_ACTIVE_WINDOW_MS) state = 'live';
      else if (nowTime >= timestamp + SESSION_ACTIVE_WINDOW_MS) state = 'completed';
      else state = 'upcoming';
    }

    return {
      ...item,
      timestamp,
      timeLabel: formatSessionTimeLabel(item.session ?? {}, offsetMinutes),
      state,
      isNext: false,
    };
  });

  const nextIndex = baseItems.findIndex((item) => item.state === 'live' || item.state === 'upcoming' || item.state === 'scheduled');
  return baseItems.map((item, index) => ({ ...item, isNext: index === nextIndex }));
}

function getSessionDate(session: { date?: string; time?: string }, offsetMinutes: number): Date | null {
  if (!session?.date) {
    return null;
  }

  const timestamp = getSessionTimestamp(session);
  if (timestamp !== null) {
    return getDisplayDate(timestamp, offsetMinutes);
  }

  const fallbackTimestamp = Date.parse(`${session.date}T00:00:00Z`);
  return Number.isNaN(fallbackTimestamp) ? null : new Date(fallbackTimestamp);
}

export function formatSessionDateTime(
  session: { date?: string; time?: string } | null | undefined,
  offsetMinutes = DEFAULT_TIME_ZONE_OFFSET,
): string {
  if (!session?.date) {
    return '-';
  }

  if (!session.time) {
    return formatDateOnly(session.date).slice(5);
  }

  const normalizedTime = session.time.trim().endsWith('Z') ? session.time.trim() : `${session.time.trim()}Z`;
  const timestamp = Date.parse(`${session.date}T${normalizedTime}`);
  if (Number.isNaN(timestamp)) {
    return formatDateOnly(session.date).slice(5);
  }

  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'UTC',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(getDisplayDate(timestamp, offsetMinutes)).replace(/\//g, '-') + ` ${formatUtcOffset(offsetMinutes)}`;
}

export function formatRaceDateTime(race: Pick<Race, 'date' | 'time'>, offsetMinutes = DEFAULT_TIME_ZONE_OFFSET): string {
  return formatSessionDateTime({ date: race.date, time: race.time }, offsetMinutes);
}

export function formatRaceDateTimeFull(race: Pick<Race, 'date' | 'time'>, offsetMinutes = DEFAULT_TIME_ZONE_OFFSET): string {
  if (!race.date) {
    return '-';
  }

  if (!race.time) {
    return formatDateOnly(race.date);
  }

  const normalizedTime = race.time.trim().endsWith('Z') ? race.time.trim() : `${race.time.trim()}Z`;
  const timestamp = Date.parse(`${race.date}T${normalizedTime}`);
  if (Number.isNaN(timestamp)) {
    return formatDateOnly(race.date);
  }

  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(getDisplayDate(timestamp, offsetMinutes)).replace(/\//g, '-') + ` ${formatUtcOffset(offsetMinutes)}`;
}

export function formatSessionDayLabel(session: { date?: string; time?: string }, offsetMinutes = DEFAULT_TIME_ZONE_OFFSET): string {
  const date = getSessionDate(session, offsetMinutes);
  if (!date) {
    return '-';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'UTC',
    weekday: 'short',
  }).format(date);
}

export function formatSessionDateLabel(session: { date?: string; time?: string }, offsetMinutes = DEFAULT_TIME_ZONE_OFFSET): string {
  const date = getSessionDate(session, offsetMinutes);
  if (!date) {
    return '-';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'UTC',
    month: '2-digit',
    day: '2-digit',
  }).format(date).replace(/\//g, '-');
}

export function formatSessionTimeLabel(session: { date?: string; time?: string }, offsetMinutes = DEFAULT_TIME_ZONE_OFFSET): string {
  const timestamp = getSessionTimestamp(session);
  if (timestamp === null) {
    return session.date ? '\u65f6\u95f4\u5f85\u5b9a' : '-';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(getDisplayDate(timestamp, offsetMinutes));
}

export function getRaceWeekendSchedule(
  race: Race | null,
  labels: {
    fp1: string;
    fp2: string;
    fp3: string;
    qualifying: string;
    sprintQualifying: string;
    sprint: string;
    race: string;
  },
): RaceWeekendSession[] {
  if (!race) {
    return [];
  }

  return [
    { key: 'fp1', label: labels.fp1, code: 'FP1', tone: 'practice' as const, session: race.FirstPractice },
    { key: 'fp2', label: labels.fp2, code: 'FP2', tone: 'practice' as const, session: race.SecondPractice },
    { key: 'fp3', label: labels.fp3, code: 'FP3', tone: 'practice' as const, session: race.ThirdPractice },
    { key: 'sprintQualifying', label: labels.sprintQualifying, code: 'SQ', tone: 'qualifying' as const, session: race.SprintQualifying },
    { key: 'sprint', label: labels.sprint, code: 'SPR', tone: 'sprint' as const, session: race.Sprint },
    { key: 'qualifying', label: labels.qualifying, code: 'Q', tone: 'qualifying' as const, session: race.Qualifying },
    { key: 'race', label: labels.race, code: 'RACE', tone: 'race' as const, session: { date: race.date, time: race.time } },
  ].filter((s) => s.session?.date) as RaceWeekendSession[];
}

export function getRaceWeekendScheduleGroups(
  sessions: RaceWeekendTimelineItem[],
  offsetMinutes = DEFAULT_TIME_ZONE_OFFSET,
): RaceWeekendScheduleGroup[] {
  const groups = new Map<string, RaceWeekendScheduleGroup>();

  sessions.forEach((item) => {
    if (!item.session?.date) return; // skip sessions without date for grouping
    const groupKey = formatSessionDateLabel(item.session, offsetMinutes);
    const sessionItem = {
      ...item,
      timeLabel: formatSessionTimeLabel(item.session, offsetMinutes),
      timestamp: getSessionTimestamp(item.session),
    };
    const currentGroup = groups.get(groupKey);

    if (currentGroup) {
      currentGroup.sessions.push(sessionItem);
      return;
    }

    groups.set(groupKey, {
      key: groupKey,
      dayLabel: formatSessionDayLabel(item.session, offsetMinutes),
      dateLabel: groupKey,
      sessions: [sessionItem],
    });
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      sessions: group.sessions.sort((a, b) => {
        if (a.timestamp === null && b.timestamp === null) {
          return 0;
        }
        if (a.timestamp === null) {
          return 1;
        }
        if (b.timestamp === null) {
          return -1;
        }
        return a.timestamp - b.timestamp;
      }),
    }))
    .sort((a, b) => {
      const firstTimestamp = a.sessions[0]?.timestamp ?? Number.MAX_SAFE_INTEGER;
      const secondTimestamp = b.sessions[0]?.timestamp ?? Number.MAX_SAFE_INTEGER;
      return firstTimestamp - secondTimestamp;
    });
}
