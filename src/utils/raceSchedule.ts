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

  const dateLabel = dayjs(session.date).format('MM-DD');
  if (!session.time) {
    return dateLabel;
  }

  const timeLabel = session.time.replace(/Z$/, '').slice(0, 5);
  return `${dateLabel} ${timeLabel} UTC`;
}

export function formatRaceDateTime(race: Pick<Race, 'date' | 'time'>): string {
  return formatSessionDateTime({ date: race.date, time: race.time });
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
