import { useMemo } from 'react';
import type { Race } from '@/types';
import { isAfterLocalDateEnd, isLocalDateAfter, isWithinRaceWeekend } from '@/utils/dateTime';

export type RaceStatus = 'ongoing' | 'completed' | 'upcoming';

interface RaceStatusInfo {
  status: RaceStatus;
  text: string;
  color: string;
  antdColor: 'warning' | 'success' | 'default';
}

export function useRaceStatus(race: Race): RaceStatusInfo {
  return useMemo(() => {
    const today = new Date();
    const isOngoingWeekend = isWithinRaceWeekend(race.date, today);
    const isCompleted = isAfterLocalDateEnd(race.date, today);

    if (isOngoingWeekend) {
      return {
        status: 'ongoing',
        text: '进行中',
        color: '#faad14',
        antdColor: 'warning',
      };
    }
    
    if (isCompleted) {
      return {
        status: 'completed',
        text: '已完成',
        color: '#52c41a',
        antdColor: 'success',
      };
    }
    
    return {
      status: 'upcoming',
      text: '未开始',
      color: '#1890ff',
      antdColor: 'default',
    };
  }, [race.date]);
}

export function getRacesByStatus(races: Race[], today = new Date()) {
  const ongoingRace = races.find((race) => {
    return isWithinRaceWeekend(race.date, today);
  });

  const futureRaces = races.filter((race) => {
    const isOngoingWeekend = isWithinRaceWeekend(race.date, today);
    return !isOngoingWeekend && isLocalDateAfter(race.date, today);
  });
  const [nextRace, ...upcomingRaces] = futureRaces;

  const completedRaces = races.filter((race) => {
    const isOngoingWeekend = isWithinRaceWeekend(race.date, today);
    const isCompleted = isAfterLocalDateEnd(race.date, today);
    return isCompleted && !isOngoingWeekend;
  });

  return { ongoingRace, nextRace, upcomingRaces, completedRaces };
}

export function useRacesByStatus(races: Race[]) {
  return useMemo(() => getRacesByStatus(races), [races]);
}
