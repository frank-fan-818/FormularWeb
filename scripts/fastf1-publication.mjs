import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { isCompleteFastF1Payload, hasCompleteSplitTelemetry } from './fastf1-payload-completeness.ts';

export async function loadCompleteSessions(root, season, round) {
  const sessions = [];
  const rejected = [];
  async function entries(directory) {
    try { return await readdir(directory, { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  }
  const years = season ? [String(season)] : (await entries(root)).filter((e) => e.isDirectory() && /^\d{4}$/.test(e.name)).map((e) => e.name);
  for (const year of years) {
    for (const entry of await entries(path.join(root, year))) {
      if (entry.isSymbolicLink()) throw new Error('Symlink in private export tree');
      if (!entry.isDirectory() || !/^[1-9]\d*$/.test(entry.name) || (round && entry.name !== String(round))) continue;
      const directory = path.join(root, year, entry.name);
      const names = await entries(directory);
      if (names.some((e) => e.isSymbolicLink())) throw new Error('Symlink in private export tree');
      for (const name of names.filter((e) => e.isFile() && /^(R|Q|S|SQ|SS|FP[123])\.json$/.test(e.name))) {
        const code = name.name.replace('.json', '');
        const key = `${year}/${entry.name}/${code}`;
        try {
          const expected = { season: year, round: entry.name, session: code };
          const bytes = await readFile(path.join(directory, name.name));
          const payload = JSON.parse(bytes);
          const files = [];
          let splitComplete = false;
          if (code === 'R' && names.some((e) => e.name === 'R-telemetry.json')) {
            const telemetry = await readFile(path.join(directory, 'R-telemetry.json'));
            const split = JSON.parse(telemetry);
            splitComplete = hasCompleteSplitTelemetry(split, expected);
            if (!splitComplete) throw new Error('Invalid split telemetry');
            files.push({ key: `${key}-telemetry.json`, bytes: telemetry });
          }
          if (!isCompleteFastF1Payload(payload, expected, splitComplete)) throw new Error('Incomplete snapshot');
          files.push({ key: `${key}.json`, bytes });
          sessions.push({ key, files });
        } catch (error) {
          if (error.code && error.code !== 'ENOENT') throw error;
          rejected.push({ key, reason: 'Snapshot failed parsing, identity or completeness checks' });
        }
      }
    }
  }
  return { sessions, rejected };
}

export async function publishSessions(sessions, upload) {
  const published = [];
  const failed = [];
  for (const session of sessions) {
    try {
      for (const file of session.files) await upload(file);
      published.push(session.key);
    } catch (error) {
      failed.push({ key: session.key, reason: error.message });
    }
  }
  return { published, failed };
}

export function nextHealth(previous, manifest, report, now) {
  const sessions = { ...previous.sessions };
  for (const race of manifest.rounds || []) {
    for (const session of race.sessions || []) {
      if (!session.eligible) continue;
      const key = `${race.round}/${session.session}`;
      const last = sessions[key] || {};
      const result = (report.results || []).find((r) => Number(r.round) === Number(race.round) && r.session === session.session);
      const failed = !session.complete || result?.status === 'failed';
      sessions[key] = {
        complete: session.complete, lastChecked: now,
        category: failed ? result?.diagnostic?.category || 'missing_snapshot' : 'complete',
        consecutiveFailures: failed ? (last.consecutiveFailures || 0) + 1 : 0,
        missingSince: failed ? last.missingSince || session.scheduledStart || now : null,
        lastSuccess: !failed ? session.generatedAt || last.lastSuccess || now : last.lastSuccess || null,
      };
    }
  }
  return { updatedAt: now, sessions };
}
