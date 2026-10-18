import cars from '@/data/constructor-cars.json';

const CURRENT_ALIASES: Record<string, string> = {
  red_bull_racing: 'red_bull', racing_bulls: 'rb',
  haas_f1_team: 'haas', cadillac_f1_team: 'cadillac',
};

export function getConstructorCar(constructorId: string, season: string): string | null {
  if (season !== String(cars.season)) return null;
  const id = constructorId.trim().toLowerCase().replace(/\s+/g, '_');
  const canonicalId = CURRENT_ALIASES[id] || id;
  const entry = (cars.constructors as Record<string, { file: string }>)[canonicalId];
  return entry ? `/images/constructors/cars/${entry.file}` : null;
}
