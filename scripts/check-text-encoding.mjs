import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const files = execFileSync(
  'git',
  ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', 'src', 'e2e', 'scripts'],
  { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
)
  .split('\0')
  .filter((file) => file !== 'scripts/check-text-encoding.mjs')
  .filter((file) => /^(?:src|e2e|scripts)\/.*\.(?:[cm]?[jt]sx?|json|md|sql|ya?ml)$/.test(file));
const mojibakePatterns = [
  { label: 'Unicode replacement character', pattern: /\uFFFD/ },
  { label: 'UTF-8 decoded as Western text', pattern: /(?:Ã[\u0080-\u00BF]|Â[\u0080-\u00BF]|â(?:€|€™|€œ|€�))/ },
  { label: 'Chinese UTF-8 decoded with the wrong code page', pattern: /(?:璧涗簨|鎼滅储|涓枃|杩斿洖|姣旇禌|銆)/ },
];
const failures = [];

for (const file of files) {
  const content = readFileSync(file, 'utf8');
  for (const { label, pattern } of mojibakePatterns) {
    const match = pattern.exec(content);
    if (!match) continue;
    const line = content.slice(0, match.index).split(/\r?\n/).length;
    failures.push(`${file}:${line} - ${label}`);
  }
}

if (failures.length > 0) {
  console.error('Text encoding check failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`Text encoding check passed: ${files.length} UTF-8 source files checked.`);
}
