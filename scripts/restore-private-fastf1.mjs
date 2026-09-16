import { mkdir, mkdtemp, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { options, privateStore, listAll, storageError } from './private-fastf1-store.mjs';
import { loadCompleteSessions } from './fastf1-publication.mjs';

const args = options();
if (!args.season) throw new Error('--season is required');
const store = privateStore();
await mkdir(args.root, { recursive: true });
const staging = await mkdtemp(path.join(args.root, '.restore-'));
let restored = 0;
try {
  const rounds = await listAll(store, args.season);
  for (const round of rounds.filter((r) => /^[1-9]\d*$/.test(r.name) && (!args.round || r.name === args.round))) {
    const prefix = `${args.season}/${round.name}`;
    for (const file of await listAll(store, prefix)) {
      if (!/^(R|Q|S|SQ|SS|FP[123])(-telemetry)?\.json$/.test(file.name)) continue;
      const key = `${prefix}/${file.name}`;
      const { data, error } = await store.download(key);
      if (error) throw storageError(`Restore ${key}`, error);
      if (!data) throw new Error(`Empty restore response: ${key}`);
      await mkdir(path.join(staging, prefix), { recursive: true });
      await writeFile(path.join(staging, key), Buffer.from(await data.arrayBuffer()));
    }
  }
  const selected = await loadCompleteSessions(staging, args.season, args.round);
  for (const session of selected.sessions) {
    for (const file of session.files) {
      await mkdir(path.dirname(path.join(args.root, file.key)), { recursive: true });
      await rename(path.join(staging, file.key), path.join(args.root, file.key));
    }
    restored += 1;
  }
  process.stdout.write(JSON.stringify({ restored, rejected: selected.rejected }) + '\n');
} finally {
  if (path.dirname(staging) !== args.root) throw new Error('Unsafe staging directory');
  await rm(staging, { recursive: true, force: true });
}
