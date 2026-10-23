import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const coreNames = new Set(['Login.tsx', 'AuthShell.tsx', 'AuthFrame.tsx', 'AuthCard.tsx', 'AuthCaptcha.tsx', 'AccessGate.tsx']);
const sorted = points => [...new Set(points)].sort((a, b) => a - b);

export function chineseCodepoints(text) {
  const decoded = text.replace(/\\u\{([0-9a-f]{1,6})\}|\\u([0-9a-f]{4})/gi, (match, extended, basic) => {
    const point = parseInt(extended || basic, 16);
    return point <= 0x10ffff ? String.fromCodePoint(point) : match;
  });
  return sorted([...decoded].map(char => char.codePointAt(0)).filter(point =>
    point >= 0x2e80 && point <= 0x9fff || point >= 0xff00 && point <= 0xffef));
}

export async function collectUiGlyphs(root) {
  const records = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(filename);
      else if (/\.(?:ts|tsx|json)$/.test(entry.name) && !entry.name.includes('.test.')) {
        records.push({ name: entry.name, filename: path.relative(root, filename), text: await readFile(filename, 'utf8') });
      }
    }
  }
  await visit(path.join(root, 'src'));
  const translationsRecord = records.find(record => record.filename.split(path.sep).join('/') === 'src/locales/zh-CN.json');
  const translations = translationsRecord ? JSON.parse(translationsRecord.text) : {};
  const ui = new Set();
  const core = new Set();
  const titles = new Set();
  const origins = new Map();
  for (const record of records) {
    // The route fallback renders before account pages; its copy must not fetch the extended subset.
    const isCore = coreNames.has(record.name)
      || record.filename.split(path.sep).join('/') === 'src/router/index.tsx';
    for (const point of chineseCodepoints(record.text)) {
      ui.add(point);
      if (!origins.has(point)) origins.set(point, new Set());
      origins.get(point).add(record.filename);
      if (isCore) core.add(point);
    }
    if (isCore) {
      for (const match of record.text.matchAll(/\bt\(['"]([^'"]+)['"]/g)) {
        for (const point of chineseCodepoints(translations[match[1]] || '')) core.add(point);
      }
    }
    if (['Register.tsx', 'ForgotPassword.tsx', 'ResetPassword.tsx', 'Login.tsx'].includes(record.name)) {
      const copy = [...record.text.matchAll(/\btitle=(['"])(.*?)\1/g)].map(match => match[2]);
      if (record.name === 'Login.tsx') {
        for (const match of record.text.matchAll(/title=\{session\s*\?\s*(['"])(.*?)\1\s*:\s*(['"])(.*?)\3\}/g)) copy.push(match[2], match[4]);
      }
      for (const point of chineseCodepoints(copy.join(''))) { titles.add(point); core.add(point); }
    }
  }
  return { uiCodepoints: sorted(ui), coreCodepoints: sorted(core), accountTitleCodepoints: sorted(titles), origins };
}

export function fontSyncPlan(required, manifest) {
  const uiCodepoints = sorted([...manifest.uiCodepoints, ...required.uiCodepoints]);
  const coreCodepoints = sorted([...(manifest.coreCodepoints || []), ...required.coreCodepoints]);
  const accountTitleCodepoints = sorted([...manifest.accountTitleCodepoints, ...required.accountTitleCodepoints]);
  const changed = (next, previous = []) => next.length !== previous.length || next.some((point, index) => point !== previous[index]);
  return { needed: changed(uiCodepoints, manifest.uiCodepoints) || changed(coreCodepoints, manifest.coreCodepoints)
    || changed(accountTitleCodepoints, manifest.accountTitleCodepoints), uiCodepoints, coreCodepoints, accountTitleCodepoints };
}
