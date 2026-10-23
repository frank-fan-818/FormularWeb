import { normalizeCircuitId } from '@/utils/circuitIds';

// Labels use the existing 500 × 500 Shanghai outline's coordinates. Orientation,
// turn sequence and start/finish are checked against F1's 2026 circuit guide:
// https://www.formula1.com/en/racing/2026/china
const shanghai = {
  viewBox: '-65 -5 570 390',
  rotation: 24,
  sourceUrl: 'https://www.formula1.com/en/racing/2026/china',
  turns: [
    { number: 1, x: 139, y: 41 },
    { number: 2, x: 187, y: 82 },
    { number: 3, x: 147, y: 97 },
    { number: 4, x: 177, y: 139 },
    { number: 5, x: 264, y: 41 },
    { number: 6, x: 386, y: 52 },
    { number: 7, x: 258, y: 150 },
    { number: 8, x: 309, y: 237 },
    { number: 9, x: 231, y: 267 },
    { number: 10, x: 233, y: 304 },
    { number: 11, x: 385, y: 236 },
    { number: 12, x: 413, y: 180 },
    { number: 13, x: 487, y: 229 },
    { number: 14, x: 3, y: 453 },
    { number: 15, x: 67, y: 376 },
    { number: 16, x: 116, y: 365 },
  ],
  startFinish: { x: 146.5, y: 252 },
} as const;

export function getCircuitDiagramGuide(circuitId: string) {
  return normalizeCircuitId(circuitId) === 'shanghai' ? shanghai : undefined;
}
