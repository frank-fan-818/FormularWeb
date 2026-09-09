import type { FiaPublishedRaceArtifact, FiaScheduledRace } from '../types/fiaUpgradeAutomation';
import { getFiaPresentationTeamBlocks, parseFiaCarPresentationText } from './fiaCarUpgrades';

const DAY_MS = 86_400_000;
const FIA_ORIGIN = 'https://www.fia.com';

export function selectFiaUpgradeRaces(races: FiaScheduledRace[], now: number): FiaScheduledRace[] {
  return races.filter(race => {
    const raceAt = Date.parse(`${race.date}T${race.time || '23:59:59Z'}`);
    if (!Number.isFinite(raceAt)) throw new Error('Invalid race date');
    return now >= raceAt - 5 * DAY_MS && now <= raceAt + 2 * DAY_MS;
  });
}

function decodeHtml(value: string): string {
  return value.replace(/&amp;/g, '&').replace(/&#0*39;|&apos;/g, "'").replace(/&quot;/g, '"');
}

function eventName(value: string): string {
  const name = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/grand\s+prix/g, '').replace(/[^a-z0-9]/g, '');
  return name === 'brazilian' ? 'saopaulo' : name;
}

export function findFiaEventPage(html: string, seasonPath: string, raceName: string): string | null {
  for (const option of html.matchAll(/<option\b[^>]*value=["']([^"']+)["'][^>]*>([\s\S]*?)<\/option>/gi)) {
    if (eventName(decodeHtml(option[2])) !== eventName(raceName)) continue;
    const path = decodeHtml(option[1]);
    const event = path.match(/\/event\/([^/?#]+)/)?.[1];
    if (event) return new URL(`${seasonPath}/event/${event}`, FIA_ORIGIN).href;
  }
  return null;
}

export function discoverFiaDocuments(html: string, season: number): string[] {
  const urls = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)].flatMap(match => {
    try {
      const url = new URL(decodeHtml(match[1]), FIA_ORIGIN);
      const name = decodeURIComponent(url.pathname).replace(/[_-]/g, ' ');
      return url.origin === FIA_ORIGIN && name.includes(String(season))
        && /car\s+presentation\s+submissions.*\.pdf$/i.test(name) ? [url.href] : [];
    } catch { return []; }
  });
  // FIA lists newest/revised documents first. Preserve that ordering.
  return [...new Set(urls)];
}

export function validateFiaPublication(
  text: string,
  metadata: Pick<FiaPublishedRaceArtifact, 'season' | 'round' | 'grandPrix' | 'documentUrl'>,
): FiaPublishedRaceArtifact {
  const header = text.slice(0, 1200).replace(/\s+/g, ' ').toLowerCase();
  if (!header.includes(String(metadata.season)) || !header.includes(metadata.grandPrix.toLowerCase())
    || !/car presentation/i.test(text)) throw new Error('Unexpected FIA document season or race');
  const blocks = getFiaPresentationTeamBlocks(text);
  const expectedTeams = metadata.season >= 2026
    ? ['McLaren', 'Mercedes', 'Red Bull Racing', 'Ferrari', 'Williams', 'Racing Bulls', 'Aston Martin', 'Haas', 'Audi', 'Alpine', 'Cadillac']
    : ['McLaren', 'Mercedes', 'Red Bull Racing', 'Ferrari', 'Williams', 'Racing Bulls', 'Aston Martin', 'Haas', 'Sauber', 'Alpine'];
  for (const team of expectedTeams) {
    if (!blocks.some(block => block.team === team || (team === 'Sauber' && /Sauber|Stake/.test(block.team)))) {
      throw new Error(`Incomplete FIA team coverage: ${team}`);
    }
  }
  const parsed = parseFiaCarPresentationText(text, { ...metadata,
    documentTitle: `${metadata.season} ${metadata.grandPrix} - Car Presentation Submissions` });
  for (const { team, rawText } of blocks) {
    if (/\bno\s+(?:updates?|upgrades?)\b/i.test(rawText)) continue;
    const declared = [...rawText.matchAll(/(?:^|\n)[ \t]*(\d{1,2})[ \t]+[^\n]+/g)];
    const records = parsed.records.filter(record => record.team === team
      && rawText.includes(record.rawText));
    if (!declared.length || declared.length !== records.length
      || declared.some((match, index) => Number(match[1]) !== index + 1)) {
      throw new Error(`Incomplete component parsing: ${team}`);
    }
  }
  return { ...metadata, generatedAt: new Date().toISOString(), source: 'FIA Car Presentation Submissions',
    records: parsed.records, summaries: parsed.summaries };
}
