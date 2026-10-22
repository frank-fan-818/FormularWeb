import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('a copy-only build adds real glyphs, becomes a no-op and still rejects corrupt assets', { timeout: 180_000 }, async () => {
  const project = path.resolve(import.meta.dirname, '..');
  await mkdir(path.join(project, '.cache/font-integration'), { recursive: true });
  const root = await mkdtemp(path.join(project, '.cache/font-integration/case-'));
  assert.equal(path.dirname(root), path.join(project, '.cache/font-integration'));
  assert.ok(path.basename(root).startsWith('case-'));
  try {
    await mkdir(path.join(root, 'scripts'), { recursive: true });
    for (const file of ['sync-ui-fonts.mjs', 'sync-ui-fonts.py', 'ui-font-glyphs.mjs', 'ui-fonts-requirements.lock', 'verify-ui-fonts.mjs']) {
      await cp(path.join(project, 'scripts', file), path.join(root, 'scripts', file));
    }
    await cp(path.join(project, 'scripts/font-sources'), path.join(root, 'scripts/font-sources'), { recursive: true });
    await cp(path.join(project, 'public/fonts'), path.join(root, 'public/fonts'), { recursive: true });
    await mkdir(path.join(root, 'src/styles'), { recursive: true });
    await mkdir(path.join(root, 'src/pages'), { recursive: true });
    await mkdir(path.join(root, 'src/locales'), { recursive: true });
    await cp(path.join(project, 'src/styles/fonts.css'), path.join(root, 'src/styles/fonts.css'));
    await writeFile(path.join(root, 'src/pages/Login.tsx'), 'title={session ? "麋" : "欢迎回来"}; t("accountLabel");');
    await writeFile(path.join(root, 'src/locales/zh-CN.json'), JSON.stringify({ accountLabel: '獾' }));
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ type: 'module', scripts: {
      prebuild: 'node scripts/sync-ui-fonts.mjs', build: 'node scripts/verify-ui-fonts.mjs',
    } }));
    const env = { ...process.env, PYTHONPATH: [path.join(project, '.cache/ui-font-tools'), process.env.PYTHONPATH].filter(Boolean).join(path.delimiter) };
    // Execute npm's actual lifecycle without a shell; supports paths containing spaces on Windows.
    const npmCli = process.env.npm_execpath;
    assert.ok(npmCli, 'Run through npm run fonts:test:integration');
    const first = spawnSync(process.execPath, [npmCli, 'run', 'build'], { cwd: root, env, encoding: 'utf8', windowsHide: true });
    assert.equal(first.status, 0, first.stdout + first.stderr);
    const manifest = JSON.parse(await readFile(path.join(root, 'public/fonts/manifest.json'), 'utf8'));
    assert.ok(manifest.uiCodepoints.includes('麋'.codePointAt(0)));
    assert.ok(manifest.accountTitleCodepoints.includes('麋'.codePointAt(0)));
    assert.ok(manifest.coreCodepoints.includes('獾'.codePointAt(0)));
    const font = path.join(root, 'public/fonts/F1UIHanzi-400-core.woff2');
    const before = await readFile(font);
    const second = spawnSync(process.execPath, [npmCli, 'run', 'build'], { cwd: root, env, encoding: 'utf8', windowsHide: true });
    assert.equal(second.status, 0, second.stdout + second.stderr);
    assert.match(second.stdout, /no Python or downloads needed/);
    assert.deepEqual(await readFile(font), before);
    const title = path.join(root, 'public/fonts/F1UIAccountTitle-400.woff2');
    const titleBytes = await readFile(title);
    assert.equal(createHash('sha256').update(titleBytes).digest('hex'), manifest.assets.find(asset => asset.file === path.basename(title)).sha256);
    await writeFile(font, Buffer.from('corrupt font'));
    const invalid = spawnSync(process.execPath, [path.join(root, 'scripts/verify-ui-fonts.mjs')], { cwd: root, env, encoding: 'utf8', windowsHide: true });
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /Invalid font: F1UIHanzi-400-core.woff2/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
