import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  findIncompleteEligibleSessions,
  shouldFailIncompleteSessions,
} from './fastf1-manifest-policy.mjs';

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
const season = Number(valueAfter('--season'));
const roundValue = valueAfter('--round');
const round = roundValue ? Number(roundValue) : undefined;
const allowIncomplete = process.argv.includes('--allow-incomplete');

if (!Number.isInteger(season) || season < 1950 || season > 2100) {
  throw new Error('--season must be a four-digit year between 1950 and 2100.');
}
if (roundValue && (!Number.isInteger(round) || round <= 0)) {
  throw new Error('--round must be a positive integer.');
}

const manifestPath = path.resolve('public', 'fastf1', String(season), 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const failures = findIncompleteEligibleSessions(manifest, round);

if (failures.length) {
  const severity = allowIncomplete ? 'pending' : 'failed';
  console.error(`FastF1 manifest verification ${severity}: ${failures.length} eligible session(s) remain incomplete.`);
  failures.forEach((failure) => {
    console.error(`- ${season} round ${failure.round} ${failure.session} (${failure.eventName}): ${failure.path}`);
  });
  if (shouldFailIncompleteSessions(failures, allowIncomplete)) {
    process.exitCode = 1;
  }
} else {
  const scope = round ? `round ${round}` : 'all eligible rounds';
  console.log(`FastF1 manifest verification passed for ${season} ${scope}.`);
}
