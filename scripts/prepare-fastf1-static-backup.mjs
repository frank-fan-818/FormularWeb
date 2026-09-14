import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadCompleteSessions } from './fastf1-publication.mjs';
import { options } from './private-fastf1-store.mjs';

const args = options();
if (!args.season) throw new Error('--season is required');
const selected = await loadCompleteSessions(args.root, args.season, args.round);
const destination = path.join(args.root, 'static-backup');
for (const session of selected.sessions) {
  for (const file of session.files) {
    const target = path.join(destination, file.key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, file.bytes);
  }
}
process.stdout.write(JSON.stringify({ preparedSessions: selected.sessions.length, rejected: selected.rejected }) + '\n');
