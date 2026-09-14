import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { loadCompleteSessions, publishSessions } from './fastf1-publication.mjs';
import { options, privateStore, storageError } from './private-fastf1-store.mjs';

const args = options();
const selected = await loadCompleteSessions(args.root, args.season, args.round);
const store = args.dryRun ? null : privateStore();
const result = await publishSessions(selected.sessions, async ({ key, bytes }) => {
  if (args.dryRun) return;
  const { error } = await store.upload(key, bytes, { contentType: 'application/json', cacheControl: '0', upsert: true });
  if (error) throw storageError('Upload ' + key, error);
  const { data, error: readError } = await store.download(key);
  if (readError) throw storageError('Verify ' + key, readError);
  if (!data || Buffer.compare(Buffer.from(await data.arrayBuffer()), bytes) !== 0) throw new Error('Verification mismatch: ' + key);
});
const report = { generatedAt: new Date().toISOString(), dryRun: args.dryRun, ...result, rejected: selected.rejected };
if (args.season) {
  const directory = path.join(args.root, args.season);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'publication-report.json'), JSON.stringify(report, null, 2));
}
process.stdout.write(JSON.stringify(report) + '\n');
if (result.failed.length || selected.rejected.length) process.exitCode = 1;
