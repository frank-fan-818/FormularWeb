import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  parseFiaCarPresentationText,
  summarizeFiaCarUpgrades,
  type FiaCarUpgradeRecord,
  type FiaCarUpgradeSummary,
} from '../src/utils/fiaCarUpgrades.ts';

interface CliOptions {
  season?: number;
  round?: number;
  grandPrix?: string;
  seasonUrl?: string;
  pdfUrl?: string;
  pdf?: string;
  text?: string;
  output: string;
  rawDir: string;
  discoverRacePdfs: boolean;
  downloadOnly: boolean;
}

interface FiaUpgradeArtifact {
  generatedAt: string;
  source: 'FIA Car Presentation Submissions';
  records: FiaCarUpgradeRecord[];
  summaries: FiaCarUpgradeSummary[];
}

interface FiaDocumentCandidate {
  title: string;
  url: string;
}

const FIA_BASE_URL = 'https://www.fia.com';
const DEFAULT_OUTPUT = path.join('docs', 'model-artifacts', 'fia-car-upgrades.json');
const DEFAULT_RAW_DIR = path.join('data', 'fia-upgrades', 'raw');

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const candidates = await discoverCandidates(options);

  if (options.downloadOnly) {
    for (const candidate of candidates) {
      await downloadPdf(candidate.url, options);
    }
    console.log(`Downloaded ${candidates.length} FIA upgrade document(s).`);
    return;
  }

  const records: FiaCarUpgradeRecord[] = [];

  if (options.text) {
    records.push(...parseTextFile(options.text, withInferredRaceMetadata(options)));
  }

  if (options.pdf) {
    records.push(...await parsePdfFile(options.pdf, withInferredRaceMetadata(options), options.pdfUrl));
  }

  for (const candidate of candidates) {
    const candidateOptions = withInferredRaceMetadata({
      ...options,
      grandPrix: options.grandPrix || inferGrandPrixFromUrl(candidate.url) || candidate.title,
    });
    const pdfPath = await tryDownloadPdf(candidate.url, candidateOptions);
    if (!pdfPath) {
      continue;
    }
    records.push(...await parsePdfFile(pdfPath, candidateOptions, candidate.url, candidate.title));
  }

  if (!records.length) {
    throw new Error([
      'No FIA upgrade records were parsed.',
      'Use --season-url to discover FIA documents, --pdf-url for one PDF, --pdf for a local PDF,',
      'or --text for text exported from a Car Presentation Submissions PDF.',
    ].join(' '));
  }

  const artifact = mergeArtifact(options.output, records);
  mkdirSync(path.dirname(options.output), { recursive: true });
  writeFileSync(options.output, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');

  console.log(`Imported ${records.length} FIA upgrade record(s).`);
  console.log(`Artifact records: ${artifact.records.length}`);
  console.log(`Wrote ${options.output}`);
}

function parseArgs(args: string[]): CliOptions {
  const raw = new Map<string, string | true>();
  args.forEach((arg) => {
    const [key, ...rest] = arg.replace(/^--/, '').split('=');
    raw.set(toCamelCase(key), rest.length ? rest.join('=') : true);
  });

  const season = numberOption(raw.get('season'));
  const round = numberOption(raw.get('round'));
  const grandPrix = stringOption(raw.get('grandPrix'));
  const inferredRound = season && grandPrix ? inferRoundFromGrandPrix(season, grandPrix) : undefined;

  return {
    season,
    round: round ?? inferredRound,
    grandPrix,
    seasonUrl: stringOption(raw.get('seasonUrl')),
    pdfUrl: stringOption(raw.get('pdfUrl')),
    pdf: stringOption(raw.get('pdf')),
    text: stringOption(raw.get('text')),
    output: stringOption(raw.get('output')) || DEFAULT_OUTPUT,
    rawDir: stringOption(raw.get('rawDir')) || DEFAULT_RAW_DIR,
    discoverRacePdfs: raw.has('discoverRacePdfs'),
    downloadOnly: raw.has('downloadOnly'),
  };
}

async function discoverCandidates(options: CliOptions): Promise<FiaDocumentCandidate[]> {
  const candidates: FiaDocumentCandidate[] = [];

  if (options.pdfUrl) {
    candidates.push({ title: options.grandPrix || 'Car Presentation Submissions', url: options.pdfUrl });
  }

  if (options.discoverRacePdfs) {
    candidates.push(...buildRacePdfCandidates(options));
  }

  if (!options.seasonUrl) {
    return dedupeCandidates(candidates);
  }

  const response = await fetch(options.seasonUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch FIA documents page: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = anchorPattern.exec(html))) {
    const href = decodeHtml(match[1]);
    const title = decodeHtml(stripTags(match[2])).replace(/\s+/g, ' ').trim();
    const searchable = `${href} ${title}`.replace(/[_-]+/g, ' ');
    if (!/car\s+presentation\s+submissions/i.test(searchable)) {
      continue;
    }

    candidates.push({
      title: title || 'Car Presentation Submissions',
      url: new URL(href, FIA_BASE_URL).toString(),
    });
  }

  return dedupeCandidates(candidates);
}

async function downloadPdf(url: string, options: CliOptions): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  const fileName = safeFileName(path.basename(new URL(url).pathname) || 'car-presentation-submissions.pdf');
  const seasonDir = options.season ? String(options.season) : 'unknown-season';
  const raceDir = options.round ? String(options.round).padStart(2, '0') : 'unknown-round';
  const targetDir = path.join(options.rawDir, seasonDir, raceDir);
  const targetPath = path.join(targetDir, fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);

  mkdirSync(targetDir, { recursive: true });
  writeFileSync(targetPath, Buffer.from(await response.arrayBuffer()));
  return targetPath;
}

async function tryDownloadPdf(url: string, options: CliOptions): Promise<string | null> {
  try {
    return await downloadPdf(url, options);
  } catch (error) {
    if (error instanceof Error && /Failed to download .*: (404|502)\b/.test(error.message)) {
      return null;
    }
    throw error;
  }
}

function parseTextFile(filePath: string, options: CliOptions): FiaCarUpgradeRecord[] {
  const text = readFileSync(filePath, 'utf8');
  return parseFiaCarPresentationText(text, {
    season: requireSeason(options),
    round: options.round,
    grandPrix: options.grandPrix,
    sourcePath: filePath,
    documentTitle: 'Car Presentation Submissions',
  }).records;
}

async function parsePdfFile(
  filePath: string,
  options: CliOptions,
  documentUrl?: string,
  documentTitle = 'Car Presentation Submissions',
): Promise<FiaCarUpgradeRecord[]> {
  const text = await extractPdfText(filePath);
  return parseFiaCarPresentationText(text, {
    season: requireSeason(options),
    round: options.round,
    grandPrix: options.grandPrix,
    sourcePath: filePath,
    documentUrl,
    documentTitle,
  }).records;
}

async function extractPdfText(filePath: string): Promise<string> {
  try {
    return execFileSync('pdftotext', ['-layout', filePath, '-'], { encoding: 'utf8' });
  } catch {
    let parser: InstanceType<(typeof import('pdf-parse'))['PDFParse']> | undefined;
    try {
      const { PDFParse } = await import('pdf-parse');
      parser = new PDFParse({ data: readFileSync(filePath) });
      const result = await parser.getText();
      return result.text;
    } catch {
      throw new Error([
        `Unable to extract PDF text from ${filePath}.`,
        'Install Poppler/pdftotext, or export the FIA PDF as text and pass --text=path-to-file.txt.',
      ].join(' '));
    } finally {
      await parser?.destroy();
    }
  }
}

function mergeArtifact(outputPath: string, newRecords: FiaCarUpgradeRecord[]): FiaUpgradeArtifact {
  const existing = readExistingArtifact(outputPath);
  const records = dedupeRecords([...newRecords, ...existing.records]);

  return {
    generatedAt: new Date().toISOString(),
    source: 'FIA Car Presentation Submissions',
    records,
    summaries: summarizeFromRecords(records),
  };
}

function readExistingArtifact(outputPath: string): FiaUpgradeArtifact {
  if (!existsSync(outputPath)) {
    return {
      generatedAt: new Date(0).toISOString(),
      source: 'FIA Car Presentation Submissions',
      records: [],
      summaries: [],
    };
  }

  return JSON.parse(readFileSync(outputPath, 'utf8')) as FiaUpgradeArtifact;
}

function summarizeFromRecords(records: FiaCarUpgradeRecord[]): FiaCarUpgradeSummary[] {
  return summarizeFiaCarUpgrades(records);
}

function dedupeRecords(records: FiaCarUpgradeRecord[]): FiaCarUpgradeRecord[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    const key = [
      record.season,
      record.round ?? '',
      record.team.toLowerCase(),
      record.carNumber ?? '',
      record.component ?? '',
      record.description ?? record.rawText,
      record.documentUrl ?? record.sourcePath ?? '',
    ].join('|');
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function dedupeCandidates(candidates: FiaDocumentCandidate[]): FiaDocumentCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.url)) {
      return false;
    }
    seen.add(candidate.url);
    return true;
  });
}

function requireSeason(options: CliOptions): number {
  if (!options.season) {
    throw new Error('Pass --season=YYYY when importing FIA upgrade documents.');
  }
  return options.season;
}

function numberOption(value: string | true | undefined): number | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
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
  return value.replace(/<[^>]+>/g, ' ');
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function safeFileName(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, '_').replace(/^_+|_+$/g, '');
}

function inferGrandPrixFromUrl(url: string): string | undefined {
  const fileName = decodeURIComponent(path.basename(new URL(url).pathname))
    .replace(/\.pdf$/i, '')
    .replace(/^\d{4}_/i, '')
    .replace(/_-_car_presentation_submissions$/i, '')
    .replace(/\s+-\s+car\s+presentation\s+submissions$/i, '')
    .replace(/_/g, ' ')
    .trim();

  if (!fileName) {
    return undefined;
  }

  return fileName.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildRacePdfCandidates(options: CliOptions): FiaDocumentCandidate[] {
  if (!options.season) {
    return [];
  }

  const racesRoot = path.join(process.cwd(), 'f1db-main', 'src', 'data', 'seasons', String(options.season), 'races');
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

      const raceSlug = officialFiaRaceSlug(match[2]);
      const name = raceSlug.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
      const title = `${options.season} ${name} Grand Prix`;
      const spacedFileName = encodeURIComponent(`${title} - Car Presentation Submissions.pdf`).replace(/%20/g, '%20');
      return [
        {
          title,
          url: `${FIA_BASE_URL}/system/files/decision-document/${options.season}_${raceSlug}_grand_prix_-_car_presentation_submissions.pdf`,
        },
        {
          title,
          url: `${FIA_BASE_URL}/system/files/decision-document/${spacedFileName}`,
        },
        {
          title,
          url: `${FIA_BASE_URL}/sites/default/files/decision-document/${spacedFileName}`,
        },
      ];
    });
}

function withInferredRaceMetadata(options: CliOptions): CliOptions {
  if (!options.season || options.round || !options.grandPrix) {
    return options;
  }

  return {
    ...options,
    round: inferRoundFromGrandPrix(options.season, options.grandPrix),
  };
}

function inferRoundFromGrandPrix(season: number, grandPrix: string): number | undefined {
  const racesRoot = path.join(process.cwd(), 'f1db-main', 'src', 'data', 'seasons', String(season), 'races');
  if (!existsSync(racesRoot)) {
    return undefined;
  }

  const target = normalizeGrandPrixKey(grandPrix);
  const candidates = readdirSync(racesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const match = entry.name.match(/^(\d+)-(.+)$/);
      return match ? { round: Number(match[1]), key: normalizeGrandPrixKey(match[2]) } : null;
    })
    .filter((entry): entry is { round: number; key: string } => Boolean(entry));

  return candidates.find((entry) => (
    entry.key === target ||
    target.includes(entry.key) ||
    entry.key.includes(target)
  ))?.round;
}

function normalizeGrandPrixKey(value: string): string {
  const normalized = value.toLowerCase()
    .replace(/\b(formula|f1|prix|grand|gp|202[0-9]|usa)\b/g, ' ')
    .replace(/\b(car|presentation|submissions)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-');
  const aliases: Record<string, string> = {
    australian: 'australia',
    austrian: 'austria',
    belgian: 'belgium',
    british: 'great-britain',
    canadian: 'canada',
    chinese: 'china',
    dutch: 'netherlands',
    'emilia-romagna': 'emilia-romagna',
    hungarian: 'hungary',
    italian: 'italy',
    japanese: 'japan',
    mexican: 'mexico',
    'saudi-arabian': 'saudi-arabia',
    spanish: 'spain',
    'united-states': 'united-states',
    'abu-dhabi': 'abu-dhabi',
  };

  return aliases[normalized] || normalized;
}

function officialFiaRaceSlug(f1dbRaceSlug: string): string {
  const aliases: Record<string, string> = {
    australia: 'australian',
    austria: 'austrian',
    belgium: 'belgian',
    canada: 'canadian',
    china: 'chinese',
    'great-britain': 'british',
    hungary: 'hungarian',
    italy: 'italian',
    japan: 'japanese',
    mexico: 'mexico_city',
    'saudi-arabia': 'saudi_arabian',
    spain: 'spanish',
  };

  return (aliases[f1dbRaceSlug] || f1dbRaceSlug).replace(/-/g, '_');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
