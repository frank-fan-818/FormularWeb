import { useMemo } from 'react';
import dayjs from 'dayjs';
import type { Race } from '@/types';

export type RaceStatus = 'ongoing' | 'completed' | 'upcoming';

interface RaceStatusInfo {
  status: RaceStatus;
  text: string;
  color: string;
  antdColor: 'warning' | 'success' | 'default';
}

export function useRaceStatus(race: Race): RaceStatusInfo {
  return useMemo(() => {
    const raceDate = dayjs(race.date);
    const today = dayjs();
    const startDate = raceDate.subtract(1, 'day').startOf('day');
    const endDate = raceDate.endOf('day');
    
    const isOngoingWeekend = today.isAfter(startDate) && today.isBefore(endDate);
    const isCompleted = today.isAfter(raceDate.endOf('day'));

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

export function useRacesByStatus(races: Race[]) {
  return useMemo(() => {
    const today = dayjs();
    
    const ongoingRace = races.find(race => {
      const raceDate = dayjs(race.date);
      const startDate = raceDate.subtract(1, 'day').startOf('day');
      const endDate = raceDate.endOf('day');
      return today.isAfter(startDate) && today.isBefore(endDate);
    });

    const nextRace = races.find(race => {
      const raceDate = dayjs(race.date);
      const startDate = raceDate.subtract(1, 'day').startOf('day');
      const endDate = raceDate.endOf('day');
      const isOngoingWeekend = today.isAfter(startDate) && today.isBefore(endDate);
      return !isOngoingWeekend && dayjs(race.date).isAfter(today);
    });

    const completedRaces = races.filter(race => {
      const raceDate = dayjs(race.date);
      const startDate = raceDate.subtract(1, 'day').startOf('day');
      const endDate = raceDate.endOf('day');
      const isOngoingWeekend = today.isAfter(startDate) && today.isBefore(endDate);
      const isCompleted = today.isAfter(raceDate.endOf('day'));
      return isCompleted && !isOngoingWeekend;
    });

    return { ongoingRace, nextRace, completedRaces };
  }, [races]);
}
