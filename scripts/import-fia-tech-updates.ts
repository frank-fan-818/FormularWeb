import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  getUpgradeComponentImportance,
  inferUpgradeComponent,
  normalizeUpgradeReason,
  summarizeFiaCarUpgrades,
  type FiaCarUpgradeRecord,
  type FiaCarUpgradeSummary,
} from '../src/utils/fiaCarUpgrades.ts';

interface CliOptions {
  season: number;
  output: string;
  dryRun: boolean;
}

interface FiaUpgradeArtifact {
  generatedAt: string;
  source: 'FIA Car Presentation Submissions';
  records: FiaCarUpgradeRecord[];
  summaries: FiaCarUpgradeSummary[];
}

interface RaceCandidate {
  round: number;
  grandPrix: string;
  urls: string[];
}

const DEFAULT_OUTPUT = path.join('docs', 'model-artifacts', 'fia-car-upgrades-full-v2.json');
const FIA_BASE_URL = 'https://www.fia.com';
const TEAM_NAMES = [
  'Red Bull Racing',
  'Red Bull',
  'AlphaTauri',
  'Toro Rosso',
  'Ferrari',
  'Mercedes',
  'McLaren',
  'Aston Martin',
  'Alpine',
  'Renault',
  'Williams',
  'Haas',
  'Alfa Romeo',
  'Sauber',
];

const COMPONENT_KEYWORDS = [
  'floor',
  'diffuser',
  'front wing',
  'rear wing',
  'beam wing',
  'sidepod',
  'bodywork',
  'engine cover',
  'cooling',
  'louvre',
  'suspension',
  'brake duct',
  'mirror',
  'nose',
];

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const raceCandidates = buildRaceCandidates(options.season);
  const records: FiaCarUpgradeRecord[] = [];

  for (const race of raceCandidates) {
    const article = await fetchFirstAvailableArticle(race.urls);
    if (!article) {
      continue;
    }

    records.push(...parseTechUpdateArticle(article.text, {
      season: options.season,
      round: race.round,
      grandPrix: race.grandPrix,
      documentTitle: article.title || `${race.grandPrix} Tech Updates`,
      documentUrl: article.url,
    }));
  }

  if (options.dryRun) {
    console.log(`Dry run: ${records.length} FIA tech update record(s) discovered.`);
    console.log([...new Set(records.map((record) => `${record.season} R${record.round} ${record.grandPrix}`))].join('\n'));
    return;
  }

  if (!records.length) {
    throw new Error(`No FIA tech update records parsed for ${options.season}.`);
  }

  const artifact = mergeArtifact(options.output, records);
  mkdirSync(path.dirname(options.output), { recursive: true });
  writeFileSync(options.output, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');

  console.log(`Imported ${records.length} FIA tech update record(s).`);
  console.log(`Artifact records: ${artifact.records.length}`);
  console.log(`Wrote ${options.output}`);
}

function parseArgs(args: string[]): CliOptions {
  const raw = new Map<string, string | true>();
  args.forEach((arg) => {
    const [key, ...rest] = arg.replace(/^--/, '').split('=');
    raw.set(toCamelCase(key), rest.length ? rest.join('=') : true);
  });

  return {
    season: numberOption(raw.get('season')) || 2023,
    output: stringOption(raw.get('output')) || DEFAULT_OUTPUT,
    dryRun: raw.has('dryRun'),
  };
}

async function fetchFirstAvailableArticle(urls: string[]) {
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        continue;
      }

      const html = await response.text();
      const title = decodeHtml(stripTags(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || ''));
      const text = decodeHtml(stripTags(html))
        .replace(/\s+/g, ' ')
        .trim();

      if (/tech updates/i.test(text) && /grand prix/i.test(text)) {
        return { url, title, text };
      }
    } catch {
      // Try the next generated FIA URL.
    }
  }

  return null;
}

function parseTechUpdateArticle(
  text: string,
  metadata: Pick<FiaCarUpgradeRecord, 'season' | 'round' | 'grandPrix' | 'documentTitle' | 'documentUrl'>,
): FiaCarUpgradeRecord[] {
  const paragraphs = text
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 80);

  return paragraphs.flatMap((paragraph) => {
    const teams = TEAM_NAMES.filter((team) => new RegExp(`\\b${escapeRegExp(team)}\\b`, 'i').test(paragraph));
    if (!teams.length || !COMPONENT_KEYWORDS.some((keyword) => paragraph.toLowerCase().includes(keyword))) {
      return [];
    }

    return teams.map((team) => {
      const area = inferUpgradeComponent(undefined, paragraph);
      return {
        season: metadata.season,
        round: metadata.round,
        grandPrix: metadata.grandPrix,
        documentTitle: metadata.documentTitle,
        documentUrl: metadata.documentUrl,
        sourceType: 'FIA_TECH_UPDATE',
        team: normalizeTeamName(team),
        area,
        component: area,
        primaryReason: normalizeUpgradeReason(paragraph),
        description: paragraph,
        rawText: paragraph,
        confidence: 0.48,
        componentImportance: getUpgradeComponentImportance(area, paragraph),
      } satisfies FiaCarUpgradeRecord;
    });
  });
}

function buildRaceCandidates(season: number): RaceCandidate[] {
  const racesRoot = path.join(process.cwd(), 'f1db-main', 'src', 'data', 'seasons', String(season), 'races');
  if (!existsSync(racesRoot)) {
    return [];
  }

  return readdirSync(racesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const match = entry.name.match(/^(\d+)-(.+)$/);
      if (!match) {
        return [];
      }

      const grandPrix = grandPrixName(match[2]);
      return [{
        round: Number(match[1]),
        grandPrix,
        urls: buildTechUpdateUrls(grandPrix),
      }];
    });
}

function buildTechUpdateUrls(grandPrix: string): string[] {
  const base = grandPrix.toLowerCase()
    .replace(/\bgrand prix\b/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return [
    `${FIA_BASE_URL}/news/f1-tech-updates-${base}-grand-prix`,
    `${FIA_BASE_URL}/news/f1-tech-updates-${base}-gp`,
    `${FIA_BASE_URL}/news/f1-tech-updates-${base}`,
    `${FIA_BASE_URL}/news/f1-tech-updates-${base}-2023-grand-prix`,
  ];
}

function grandPrixName(slug: string): string {
  const aliases: Record<string, string> = {
    australia: 'Australian Grand Prix',
    austria: 'Austrian Grand Prix',
    azerbaijan: 'Azerbaijan Grand Prix',
    bahrain: 'Bahrain Grand Prix',
    belgium: 'Belgian Grand Prix',
    canada: 'Canadian Grand Prix',
    'great-britain': 'British Grand Prix',
    hungary: 'Hungarian Grand Prix',
    italy: 'Italian Grand Prix',
    japan: 'Japanese Grand Prix',
    mexico: 'Mexico City Grand Prix',
    'saudi-arabia': 'Saudi Arabian Grand Prix',
    spain: 'Spanish Grand Prix',
    'united-states': 'United States Grand Prix',
    'abu-dhabi': 'Abu Dhabi Grand Prix',
  };

  return aliases[slug] || `${slug.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())} Grand Prix`;
}

function mergeArtifact(outputPath: string, newRecords: FiaCarUpgradeRecord[]): FiaUpgradeArtifact {
  const existing = existsSync(outputPath)
    ? JSON.parse(readFileSync(outputPath, 'utf8')) as FiaUpgradeArtifact
    : { generatedAt: new Date(0).toISOString(), source: 'FIA Car Presentation Submissions' as const, records: [], summaries: [] };
  const records = dedupeRecords([...newRecords, ...existing.records]);

  return {
    generatedAt: new Date().toISOString(),
    source: 'FIA Car Presentation Submissions',
    records,
    summaries: summarizeFiaCarUpgrades(records),
  };
}

function dedupeRecords(records: FiaCarUpgradeRecord[]): FiaCarUpgradeRecord[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    const key = [
      record.sourceType,
      record.season,
      record.round ?? '',
      record.team.toLowerCase(),
      record.component ?? '',
      record.documentUrl ?? '',
      record.rawText.slice(0, 240),
    ].join('|');
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function normalizeTeamName(team: string) {
  return team === 'Red Bull' ? 'Red Bull Racing' : team;
}

function numberOption(value: string | true | undefined): number | undefined {
  if (typeof value !== 'string') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function stringOption(value: string | true | undefined): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function toCamelCase(value: string): string {
  return value.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function stripTags(value: string): string {
  return value.replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
