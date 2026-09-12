import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PDFParse } from 'pdf-parse';
import { parseFiaCarPresentationText } from '../src/utils/fiaCarUpgrades.ts';

// Explicit FIA document manifest keeps calendar round numbers reviewable.
const manifestPath = process.argv[2];
if (!manifestPath) throw new Error('Usage: tsx scripts/sync-fia-upgrade-snapshots.ts <manifest.json> [downloaded-pdf-directory]');
const pdfDirectory = process.argv[3];
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
  season: number;
  races: Array<{ round: number; grandPrix: string; documentUrl: string }>;
};
if (!Number.isInteger(manifest.season) || manifest.season < 1950) throw new Error('Invalid season');

for (const race of manifest.races) {
  const url = new URL(race.documentUrl);
  if (url.protocol !== 'https:' || url.hostname !== 'www.fia.com'
    || !Number.isInteger(race.round) || race.round < 1) throw new Error('Invalid FIA document entry');
  let bytes: Uint8Array;
  if (pdfDirectory) {
    bytes = new Uint8Array(readFileSync(path.join(pdfDirectory, `${race.round}.pdf`)));
  } else {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`FIA round ${race.round}: HTTP ${response.status}`);
    bytes = new Uint8Array(await response.arrayBuffer());
  }
  const parser = new PDFParse({ data: bytes });
  try {
    const { text } = await parser.getText();
    if (!text.includes(String(manifest.season)) || !/Car Presentation/i.test(text)
      || !text.replace(/\s+/g, ' ').toLowerCase().includes(race.grandPrix.toLowerCase())) {
      throw new Error(`Unexpected document for round ${race.round}`);
    }
    const parsed = parseFiaCarPresentationText(text, {
      season: manifest.season,
      ...race,
      documentTitle: `${manifest.season} ${race.grandPrix} - Car Presentation Submissions`,
    });
    if (!parsed.records.length) throw new Error(`No upgrades parsed for round ${race.round}; review the document`);
    const directory = `data/fia-upgrades/${manifest.season}`;
    mkdirSync(directory, { recursive: true });
    writeFileSync(`${directory}/${race.round}.json`, `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      source: 'FIA Car Presentation Submissions',
      records: parsed.records,
      summaries: parsed.summaries,
    }, null, 2)}\n`);
    console.info(JSON.stringify({ event: 'fia_snapshot_written', season: manifest.season, round: race.round,
      records: parsed.records.length, teams: parsed.summaries.length }));
  } finally {
    await parser.destroy();
  }
}
