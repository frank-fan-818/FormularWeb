import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { useAppStore } from '@/store';
import { useRaceSchedule } from './useRaceSchedule';

vi.mock('@/store', async () => {
  const { create: createStore } = await import('zustand');
  return { useAppStore: createStore(() => ({ timeZoneOffsetMinutes: 480 })) };
});

function SchedulePreview() {
  const schedule = useRaceSchedule();
  return <output>{schedule.formatRaceDateTimeFull({ date: '2026-11-01', time: '20:00:00Z' })}</output>;
}

describe('reactive race schedule preference', () => {
  it('updates a mounted time display immediately when the preference changes', () => {
    let view!: ReturnType<typeof create>;
    act(() => { view = create(<SchedulePreview />); });
    expect(view.root.findByType('output').children).toEqual(['2026-11-02 04:00 UTC+8']);
    act(() => useAppStore.setState({ timeZoneOffsetMinutes: 0 }));
    expect(view.root.findByType('output').children).toEqual(['2026-11-01 20:00 UTC+0']);
    view.unmount();
  });
});
