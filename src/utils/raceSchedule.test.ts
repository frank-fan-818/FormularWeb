import { describe, expect, it } from 'vitest';
import {
  formatRaceDateTimeFull,
  formatSessionDateTime,
  getRaceWeekendSchedule,
  getRaceWeekendScheduleGroups,
} from '@/utils/raceSchedule';
import type { Race } from '@/types';

const labels = {
  fp1: 'Practice 1',
  fp2: 'Practice 2',
  fp3: 'Practice 3',
  qualifying: 'Qualifying',
  sprintQualifying: 'Sprint Qualifying',
  sprint: 'Sprint',
  race: 'Race',
};

function makeRace(overrides: Partial<Race> = {}): Race {
  return {
    season: '2025',
    round: '3',
    url: '#',
    raceName: 'Japanese Grand Prix',
    Circuit: {
      circuitId: 'suzuka',
      url: '#',
      circuitName: 'Suzuka Circuit',
      Location: {
        lat: '34.8431',
        long: '136.541',
        locality: 'Suzuka',
        country: 'Japan',
      },
    },
    date: '2025-04-06',
    time: '05:00:00Z',
    ...overrides,
  };
}

describe('raceSchedule', () => {
  it('formats UTC session times in Beijing time', () => {
    expect(formatSessionDateTime({ date: '2025-03-14', time: '16:00:00Z' }))
      .toBe('03-15 00:00 北京时间');
    expect(formatRaceDateTimeFull({ date: '2025-03-16', time: '04:00:00Z' }))
      .toBe('2025-03-16 12:00 北京时间');
  });

  it('falls back cleanly when only a date is available', () => {
    expect(formatSessionDateTime({ date: '2025-03-14' })).toBe('03-14');
    expect(formatRaceDateTimeFull({ date: '2025-03-16' })).toBe('2025-03-16');
  });

  it('builds sprint weekend sessions in event order before grouping', () => {
    const race = makeRace({
      FirstPractice: { date: '2025-04-04', time: '02:30:00Z' },
      SprintQualifying: { date: '2025-04-04', time: '06:30:00Z' },
      Sprint: { date: '2025-04-05', time: '03:00:00Z' },
      Qualifying: { date: '2025-04-05', time: '07:00:00Z' },
    });

    expect(getRaceWeekendSchedule(race, labels).map((session) => session.key)).toEqual([
      'fp1',
      'sprintQualifying',
      'sprint',
      'qualifying',
      'race',
    ]);
  });

  it('groups sessions by Beijing calendar day and sorts within each day', () => {
    const sessions = getRaceWeekendSchedule(makeRace({
      date: '2025-03-16',
      time: '04:00:00Z',
      FirstPractice: { date: '2025-03-14', time: '03:30:00Z' },
      Qualifying: { date: '2025-03-15', time: '06:00:00Z' },
      ThirdPractice: { date: '2025-03-15' },
    }), labels);

    const groups = getRaceWeekendScheduleGroups(sessions);

    expect(groups.map((group) => group.dateLabel)).toEqual(['03-14', '03-15', '03-16']);
    expect(groups[1].sessions.map((session) => session.key)).toEqual(['qualifying', 'fp3']);
    expect(groups[1].sessions.map((session) => session.timeLabel)).toEqual(['14:00', '时间待定']);
  });
});
