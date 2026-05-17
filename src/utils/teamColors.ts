// Current and historical F1 constructor brand colors.
const teamColorMap: Record<string, string> = {
  red_bull: '#1e5bc6',
  ferrari: '#dc0000',
  mercedes: '#00d2be',
  mclaren: '#ff8700',
  aston_martin: '#006f62',
  alpine: '#0090ff',
  alphatauri: '#2b4562',
  alfa: '#900000',
  haas: '#000000',
  williams: '#005aff',
  sauber: '#00e700',
  rb: '#0e4da4',
  jordan: '#ffff00',
  benetton: '#008856',
  renault: '#fff500',
  brawn: '#c8c8c8',
  lotus: '#ffb800',
};

const DEFAULT_COLOR = '#334155';

export function getTeamColor(constructorId: string, isText = false): string {
  const color = teamColorMap[constructorId.toLowerCase()] || DEFAULT_COLOR;

  if (isText && ['#ffffff', '#ffff00', '#fff500', '#ffb800', '#00e700', '#c8c8c8'].includes(color)) {
    return '#111827';
  }

  return color;
}

export function getTeamBackgroundColor(constructorId: string): React.CSSProperties {
  return {
    backgroundColor: getTeamColor(constructorId),
    color: getTeamColor(constructorId, true),
  };
}

function darkenColor(hexColor: string, factor: number = 0.7): string {
  const hex = hexColor.replace('#', '');

  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  const newR = Math.floor(r * factor);
  const newG = Math.floor(g * factor);
  const newB = Math.floor(b * factor);

  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

export function getTeamDarkColor(constructorId: string): string {
  const baseColor = getTeamColor(constructorId);
  return darkenColor(baseColor, 0.75);
}
