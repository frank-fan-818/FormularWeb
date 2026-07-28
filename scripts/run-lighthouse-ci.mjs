import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import lighthouseConfig from '../.lighthouserc.cjs';

const projectRoot = resolve(import.meta.dirname, '..');
const reportDir = resolve(projectRoot, '.lighthouseci', 'reports');
const chromeProfileDir = resolve(projectRoot, '.lighthouseci', 'chrome-profile');
const serverEntry = resolve(projectRoot, 'scripts', 'serve-dist.mjs');
const previewUrl = 'http://127.0.0.1:4173/';
const configuredRuns = lighthouseConfig?.ci?.collect?.numberOfRuns || 1;
const numberOfRuns = process.env.CI ? configuredRuns : 1;

rmSync(reportDir, { recursive: true, force: true });
rmSync(chromeProfileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
mkdirSync(reportDir, { recursive: true });
mkdirSync(chromeProfileDir, { recursive: true });

const preview = spawn(
  process.execPath,
  [serverEntry],
  {
    cwd: projectRoot,
    env: { ...process.env, F1_API_MOCK_EMPTY: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  },
);
const previewClosed = once(preview, 'close');

let previewOutput = '';
preview.stdout.on('data', (chunk) => { previewOutput += chunk.toString(); });
preview.stderr.on('data', (chunk) => { previewOutput += chunk.toString(); });

async function waitForPreview() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (preview.exitCode !== null) {
      throw new Error(`Vite preview exited before Lighthouse started:\n${previewOutput}`);
    }
    try {
      const response = await fetch(previewUrl);
      if (response.ok) return;
    } catch {
      // The preview server is still starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error(`Timed out waiting for Vite preview:\n${previewOutput}`);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function aggregate(values, method, higherIsBetter) {
  if (method === 'pessimistic') {
    return higherIsBetter ? Math.min(...values) : Math.max(...values);
  }
  return median(values);
}

function auditValue(result, id, condition) {
  if (id.startsWith('categories:')) {
    return result.categories[id.slice('categories:'.length)]?.score;
  }
  const audit = result.audits[id];
  if (!audit) return undefined;
  if ('maxNumericValue' in condition || 'minNumericValue' in condition) return audit.numericValue;
  if ('maxLength' in condition || 'minLength' in condition) return audit.details?.items?.length ?? 0;
  return audit.score;
}

function validateReports(results) {
  const failures = [];
  const warnings = [];
  const assertions = lighthouseConfig?.ci?.assert?.assertions || {};

  for (const [id, assertion] of Object.entries(assertions)) {
    const [level, condition = {}] = Array.isArray(assertion) ? assertion : ['error', assertion];
    const values = results
      .map((result) => auditValue(result, id, condition))
      .filter((value) => Number.isFinite(value));

    if (!values.length) {
      const message = `${id}: audit was not produced by this Lighthouse version`;
      (level === 'error' ? failures : warnings).push(message);
      continue;
    }

    const minimumKey = ['minScore', 'minNumericValue', 'minLength']
      .find((key) => key in condition);
    const maximumKey = ['maxNumericValue', 'maxLength']
      .find((key) => key in condition);
    const thresholdKey = minimumKey || maximumKey;
    if (!thresholdKey) continue;

    const higherIsBetter = Boolean(minimumKey);
    const measured = aggregate(
      values,
      condition.aggregationMethod || 'median',
      higherIsBetter,
    );
    const expected = condition[thresholdKey];
    const passed = higherIsBetter ? measured >= expected : measured <= expected;
    if (!passed) {
      const message = `${id}: ${measured} did not satisfy ${thresholdKey}=${expected}`;
      (level === 'error' ? failures : warnings).push(message);
    }
  }

  warnings.forEach((message) => process.stderr.write(`Lighthouse warning: ${message}\n`));
  if (failures.length) {
    throw new Error(`Lighthouse quality gate failed:\n- ${failures.join('\n- ')}`);
  }
}

async function stopPreview() {
  if (preview.exitCode !== null) return;

  preview.kill('SIGTERM');
  await Promise.race([
    previewClosed,
    new Promise((resolveWait) => setTimeout(resolveWait, 3_000)),
  ]);

  if (preview.exitCode === null) {
    preview.kill('SIGKILL');
    await Promise.race([
      previewClosed,
      new Promise((resolveWait) => setTimeout(resolveWait, 2_000)),
    ]);
  }
}

let chrome;
try {
  await waitForPreview();
  chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox'],
    userDataDir: chromeProfileDir,
  });

  const results = [];
  for (let index = 0; index < numberOfRuns; index += 1) {
    const runnerResult = await lighthouse(previewUrl, {
      port: chrome.port,
      output: ['json', 'html'],
      logLevel: 'error',
    });
    if (!runnerResult) throw new Error('Lighthouse did not return a report.');

    results.push(runnerResult.lhr);
    const reports = Array.isArray(runnerResult.report)
      ? runnerResult.report
      : [runnerResult.report];
    writeFileSync(
      resolve(reportDir, `run-${index + 1}.report.json`),
      reports[0],
      'utf8',
    );
    if (reports[1]) {
      writeFileSync(
        resolve(reportDir, `run-${index + 1}.report.html`),
        reports[1],
        'utf8',
      );
    }
  }

  validateReports(results);
  const categorySummary = ['performance', 'accessibility', 'best-practices', 'seo']
    .map((category) => {
      const values = results.map((result) => result.categories[category]?.score ?? 0);
      return `${category}=${median(values).toFixed(2)}`;
    })
    .join(', ');
  process.stdout.write(
    `Lighthouse gate passed across ${numberOfRuns} run(s): ${categorySummary}.\n`,
  );
} finally {
  if (chrome) {
    await Promise.race([
      Promise.resolve().then(() => chrome.kill()).catch((error) => {
        process.stderr.write(`Lighthouse Chrome cleanup warning: ${error.message}\n`);
      }),
      new Promise((resolveWait) => setTimeout(resolveWait, 5_000)),
    ]);
  }
  await stopPreview();
}

process.exit(0);
