import dayjs from 'dayjs';
import type { Race } from '@/types';

export interface RaceWeekendSession {
  key: string;
  label: string;
  code: string;
  tone: 'practice' | 'qualifying' | 'sprint' | 'race';
  session: {
    date?: string;
    time?: string;
  };
}

export interface RaceWeekendScheduleGroup {
  key: string;
  dayLabel: string;
  dateLabel: string;
  sessions: Array<RaceWeekendSession & {
    timeLabel: string;
    timestamp: number | null;
  }>;
}

const BEIJING_TIME_ZONE = 'Asia/Shanghai';

function getSessionTimestamp(session: { date?: string; time?: string } | null | undefined): number | null {
  if (!session?.date || !session.time) {
    return null;
  }

  const normalizedTime = session.time.trim().endsWith('Z') ? session.time.trim() : `${session.time.trim()}Z`;
  const timestamp = Date.parse(`${session.date}T${normalizedTime}`);

  return Number.isNaN(timestamp) ? null : timestamp;
}

function getSessionDate(session: { date?: string; time?: string }): Date | null {
  if (!session?.date) {
    return null;
  }

  const timestamp = getSessionTimestamp(session);
  if (timestamp !== null) {
    return new Date(timestamp);
  }

  const fallbackTimestamp = Date.parse(`${session.date}T00:00:00Z`);
  return Number.isNaN(fallbackTimestamp) ? null : new Date(fallbackTimestamp);
}

export function formatSessionDateTime(session: { date?: string; time?: string } | null | undefined): string {
  if (!session?.date) {
    return '-';
  }

  if (!session.time) {
    return dayjs(session.date).format('MM-DD');
  }

  const normalizedTime = session.time.trim().endsWith('Z') ? session.time.trim() : `${session.time.trim()}Z`;
  const timestamp = Date.parse(`${session.date}T${normalizedTime}`);
  if (Number.isNaN(timestamp)) {
    return dayjs(session.date).format('MM-DD');
  }

  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: BEIJING_TIME_ZONE,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp)).replace(/\//g, '-') + ' \u5317\u4eac\u65f6\u95f4';
}

export function formatRaceDateTime(race: Pick<Race, 'date' | 'time'>): string {
  return formatSessionDateTime({ date: race.date, time: race.time });
}

export function formatRaceDateTimeFull(race: Pick<Race, 'date' | 'time'>): string {
  if (!race.date) {
    return '-';
  }

  if (!race.time) {
    return dayjs(race.date).format('YYYY-MM-DD');
  }

  const normalizedTime = race.time.trim().endsWith('Z') ? race.time.trim() : `${race.time.trim()}Z`;
  const timestamp = Date.parse(`${race.date}T${normalizedTime}`);
  if (Number.isNaN(timestamp)) {
    return dayjs(race.date).format('YYYY-MM-DD');
  }

  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: BEIJING_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp)).replace(/\//g, '-') + ' \u5317\u4eac\u65f6\u95f4';
}

export function formatSessionDayLabel(session: { date?: string; time?: string }): string {
  const date = getSessionDate(session);
  if (!date) {
    return '-';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: BEIJING_TIME_ZONE,
    weekday: 'short',
  }).format(date);
}

export function formatSessionDateLabel(session: { date?: string; time?: string }): string {
  const date = getSessionDate(session);
  if (!date) {
    return '-';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: BEIJING_TIME_ZONE,
    month: '2-digit',
    day: '2-digit',
  }).format(date).replace(/\//g, '-');
}

export function formatSessionTimeLabel(session: { date?: string; time?: string }): string {
  const timestamp = getSessionTimestamp(session);
  if (timestamp === null) {
    return session.date ? '\u65f6\u95f4\u5f85\u5b9a' : '-';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: BEIJING_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp));
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
  ].filter((item) => item.session?.date) as RaceWeekendSession[];
}

export function getRaceWeekendScheduleGroups(sessions: RaceWeekendSession[]): RaceWeekendScheduleGroup[] {
  const groups = new Map<string, RaceWeekendScheduleGroup>();

  sessions.forEach((item) => {
    const groupKey = formatSessionDateLabel(item.session);
    const sessionItem = {
      ...item,
      timeLabel: formatSessionTimeLabel(item.session),
      timestamp: getSessionTimestamp(item.session),
    };
    const currentGroup = groups.get(groupKey);

    if (currentGroup) {
      currentGroup.sessions.push(sessionItem);
      return;
    }

    groups.set(groupKey, {
      key: groupKey,
      dayLabel: formatSessionDayLabel(item.session),
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
