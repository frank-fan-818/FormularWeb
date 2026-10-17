import type { Race } from '@/types';

// Compact venue labels keep sponsor names out of overview cards.
const SHORT_NAMES: Record<string, string> = {
  miami: 'Miami',
  imola: 'Imola',
  catalunya: 'Barcelona',
  madring: 'Madrid',
  silverstone: 'Britain',
  americas: 'United States',
  interlagos: 'São Paulo',
  vegas: 'Las Vegas',
  yas_marina: 'Abu Dhabi',
};

export function formatShortRaceName(race: Pick<Race, 'raceName' | 'Circuit'> | null | undefined): string {
  if (!race) return '--';
  const circuit = race.Circuit;
  return SHORT_NAMES[circuit?.circuitId ?? '']
    || circuit?.Location?.country?.trim()
    || race.raceName.replace(/\s*(?:Grand Prix|GP|大奖赛)\s*$/i, '').trim()
    || circuit?.Location?.locality
    || '--';
}
