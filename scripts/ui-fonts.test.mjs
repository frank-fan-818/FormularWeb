import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { collectUiGlyphs, fontSyncPlan } from './ui-font-glyphs.mjs';

test('new literal and escaped Chinese copy is discovered without including test fixtures', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ui-font-glyphs-'));
  assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
  assert.ok(path.basename(root).startsWith('ui-font-glyphs-'));
  try {
    await mkdir(path.join(root, 'src', 'pages'), { recursive: true });
    await mkdir(path.join(root, 'src', 'locales'), { recursive: true });
    await writeFile(path.join(root, 'src', 'pages', 'Login.tsx'), 'title={session ? "欢迎" : "登录"}; t("accountLabel");');
    await writeFile(path.join(root, 'src', 'pages', 'Register.tsx'), 'title="创建账号"');
    await writeFile(path.join(root, 'src', 'locales', 'zh-CN.json'), '{"accountLabel":"新闻帖子","escaped":"\\u544a"}');
    await writeFile(path.join(root, 'src', 'pages', 'News.tsx'), 'const label = "\\u{793e}";');
    await writeFile(path.join(root, 'src', 'fixture.test.ts'), 'this_test_only = "龘"');
    const glyphs = await collectUiGlyphs(root);
    for (const char of '新闻帖子告社欢迎登录创建账号') assert.ok(glyphs.uiCodepoints.includes(char.codePointAt(0)), char);
    for (const char of '新闻帖子') assert.ok(glyphs.coreCodepoints.includes(char.codePointAt(0)), char);
    for (const char of '欢迎登录创建账号') assert.ok(glyphs.accountTitleCodepoints.includes(char.codePointAt(0)), char);
    assert.ok(!glyphs.uiCodepoints.includes('龘'.codePointAt(0)));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('planning includes core and account title coverage, retains existing glyphs and becomes a no-op after sync', () => {
  const required = { uiCodepoints: [1, 2, 3], coreCodepoints: [2, 3], accountTitleCodepoints: [3] };
  const before = { uiCodepoints: [1, 2, 4], coreCodepoints: [1], accountTitleCodepoints: [] };
  const plan = fontSyncPlan(required, before);
  assert.equal(plan.needed, true);
  assert.deepEqual(plan.uiCodepoints, [1, 2, 3, 4]);
  assert.deepEqual(plan.coreCodepoints, [1, 2, 3]);
  assert.deepEqual(plan.accountTitleCodepoints, [3]);
  assert.equal(fontSyncPlan(required, plan).needed, false);
});

test('CI prepares fonts before verification and every production build prepares them first', async () => {
  const root = path.resolve(import.meta.dirname, '..');
  const workflow = await readFile(path.join(root, '.github', 'workflows', 'ci.yml'), 'utf8');
  const testJob = workflow.split('\n  test:')[1].split('\n  build:')[0];
  assert.ok(testJob.indexOf('npm run fonts:sync') >= 0);
  assert.ok(testJob.indexOf('npm run fonts:sync') < testJob.indexOf('npm run fonts:verify'));
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts.prebuild, 'npm run fonts:sync');
  assert.ok(pkg.scripts['fonts:verify'].includes('verify-ui-fonts.mjs'));
});
