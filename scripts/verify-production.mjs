import { mkdir, writeFile, appendFile } from 'node:fs/promises';
import { verifyProduction } from './verify-production-lib.mjs';

if (!process.env.PRODUCTION_URL) throw new Error('Set PRODUCTION_URL to the HTTPS origin to verify.');
const report = await verifyProduction({ baseUrl: process.env.PRODUCTION_URL,
  expectedVersion: process.env.EXPECTED_RELEASE_VERSION || undefined });
await mkdir('artifacts/production', { recursive: true });
await writeFile('artifacts/production/verification.json', JSON.stringify(report, null, 2) + '\n');
const summary = [`Production verification: ${report.status}`, `Origin: ${report.origin}`,
  `Availability: ${report.availability}`,
  `Release: ${report.release?.version || 'unverified'} / ${report.release?.buildId || 'unverified'}`,
  ...report.checks.map(check => `${check.passed ? 'PASS' : 'FAIL'} ${check.id}`)].join('\n');
process.stdout.write(summary + '\n');
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `\n\`\`\`text\n${summary}\n\`\`\`\n`);
if (report.status !== 'pass') process.exitCode = 1;
