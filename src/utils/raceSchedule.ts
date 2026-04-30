import dayjs from 'dayjs';
import type { Race } from '@/types';

export interface RaceWeekendSession {
  key: string;
  label: string;
  session: {
    date?: string;
    time?: string;
  };
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
    timeZone: 'Asia/Shanghai',
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
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp)).replace(/\//g, '-') + ' \u5317\u4eac\u65f6\u95f4';
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
    { key: 'fp1', label: labels.fp1, session: race.FirstPractice },
    { key: 'fp2', label: labels.fp2, session: race.SecondPractice },
    { key: 'fp3', label: labels.fp3, session: race.ThirdPractice },
    { key: 'sprintQualifying', label: labels.sprintQualifying, session: race.SprintQualifying },
    { key: 'sprint', label: labels.sprint, session: race.Sprint },
    { key: 'qualifying', label: labels.qualifying, session: race.Qualifying },
    { key: 'race', label: labels.race, session: { date: race.date, time: race.time } },
  ].filter((item) => item.session?.date) as RaceWeekendSession[];
}
