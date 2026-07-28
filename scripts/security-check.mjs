import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const failures = [];

function addFailure(file, message, line) {
  failures.push(`${file}${line ? `:${line}` : ''} - ${message}`);
}

function getCandidateFiles() {
  return execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    {
    cwd: projectRoot,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    },
  ).split('\0').filter((file) => file && existsSync(path.join(projectRoot, file)));
}

const candidateFiles = getCandidateFiles();
const forbiddenTrackedFiles = [
  /(^|\/)\.env($|\.)/i,
  /(^|\/)(id_rsa|id_ed25519)$/i,
  /\.(?:pem|key|p12|pfx)$/i,
  /(^|\/)(?:dist|coverage)\//i,
  /\.log$/i,
];

for (const file of candidateFiles) {
  if (file === '.env.example') continue;
  if (forbiddenTrackedFiles.some((pattern) => pattern.test(file))) {
    addFailure(file, 'sensitive or generated file must not be tracked');
  }
}

const gitignore = readFileSync(path.join(projectRoot, '.gitignore'), 'utf8');
const requiredIgnoreRules = [
  { label: '.env', pattern: /^\.env$/m },
  { label: '.env.*.local', pattern: /^\.env\.\*\.local$/m },
  { label: 'node_modules', pattern: /^node_modules\/?$/m },
  { label: 'dist', pattern: /^dist\/?$/m },
  { label: 'coverage', pattern: /^coverage\/?$/m },
  { label: 'logs', pattern: /^\*\.log$/m },
  { label: '.claude', pattern: /^\.claude\/$/m },
];

for (const rule of requiredIgnoreRules) {
  if (!rule.pattern.test(gitignore)) {
    addFailure('.gitignore', `missing required ignore rule for ${rule.label}`);
  }
}

const scannableExtensions = new Set([
  '.cjs', '.css', '.html', '.js', '.json', '.jsx', '.md', '.mjs',
  '.sql', '.ts', '.tsx', '.yaml', '.yml',
]);
const excludedPrefixes = [
  'data/',
  'f1db-main/',
  'src/assets/',
];
const excludedFiles = new Set([
  'package-lock.json',
  'scripts/security-check.mjs',
]);

const secretPatterns = [
  { label: 'private key material', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { label: 'AWS access key', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { label: 'GitHub token', pattern: /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/ },
  { label: 'Slack token', pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/ },
  { label: 'credential-bearing database URL', pattern: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^:\s/]+:[^@\s/]+@/i },
  { label: 'JWT-like credential', pattern: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/ },
];

const assignmentPattern = /\b(api[_-]?key|client[_-]?secret|password|token|webhook|database_url|service_role_key)\b\s*[:=]\s*['"]([^'"\r\n]{8,})['"]/ig;
const placeholderPattern = /(example|placeholder|redacted|your-|dummy|mock|test-only|not-a-real|\$\{\{|<[^>]+>)/i;

for (const file of candidateFiles) {
  if (excludedFiles.has(file) || excludedPrefixes.some((prefix) => file.startsWith(prefix))) continue;
  if (!scannableExtensions.has(path.extname(file).toLowerCase())) continue;

  const content = readFileSync(path.join(projectRoot, file), 'utf8');
  const lines = content.split(/\r?\n/);

  for (const secretPattern of secretPatterns) {
    const match = secretPattern.pattern.exec(content);
    if (match) {
      const line = content.slice(0, match.index).split(/\r?\n/).length;
      addFailure(file, `possible ${secretPattern.label}`, line);
    }
  }

  assignmentPattern.lastIndex = 0;
  for (const match of content.matchAll(assignmentPattern)) {
    if (placeholderPattern.test(match[2])) continue;
    const line = content.slice(0, match.index).split(/\r?\n/).length;
    addFailure(file, `possible hardcoded ${match[1]} value`, line);
  }

  if (file.startsWith('src/') && !/\.test\.[^.]+$/.test(file)) {
    lines.forEach((lineText, index) => {
      const trimmed = lineText.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
      if (/\bconsole\.(?:log|trace)\s*\(/.test(lineText)) {
        addFailure(file, 'shipped source must use the structured logger', index + 1);
      }
      if (/\b(?:eval|Function)\s*\(|dangerouslySetInnerHTML|document\.write\s*\(|\.innerHTML\s*=/.test(lineText)) {
        addFailure(file, 'dangerous dynamic code or HTML sink detected', index + 1);
      }
    });
  }

  if (file.startsWith('scripts/sql/') && file.endsWith('.sql')) {
    for (const statement of content.split(';')) {
      const normalized = statement.replace(/--.*$/gm, ' ').replace(/\s+/g, ' ').trim();
      if (!normalized) continue;

      if (/\bgrant\b[^;]*\b(insert|update|delete|truncate)\b[^;]*\bto\s+anon\b/i.test(normalized)) {
        addFailure(file, 'anonymous database write grant detected');
      }

      if (/\bcreate\s+policy\b/i.test(normalized)
        && /\bfor\s+(insert|update|delete|all)\b/i.test(normalized)
        && !/\bto\s+(authenticated|service_role)\b/i.test(normalized)) {
        addFailure(file, 'write policy must explicitly target authenticated or service_role');
      }
    }
  }
}

if (failures.length) {
  console.error(`Security check failed (${failures.length} finding${failures.length === 1 ? '' : 's'}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.info(
    `Security check passed: ${candidateFiles.length} tracked and untracked release-candidate files reviewed.`,
  );
}
