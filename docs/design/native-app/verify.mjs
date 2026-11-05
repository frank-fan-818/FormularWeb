import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const output = resolve('artifacts/native-android/design');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PROTOTYPE_BROWSER_CHANNEL || 'chrome' });
const errors = [];
const results = [];
const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
const click = (action, value) => page.locator(`[data-action="${action}"]${value === undefined ? '' : `[data-value="${value}"]`}`).first().click();
const expectTitle = async text => assert.equal(await page.locator('h1').innerText(), text);
const noOverflow = async () => {
  const info = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }));
  assert.ok(info.content <= info.viewport, JSON.stringify(info));
};

try {
  await page.goto(pathToFileURL(resolve('docs/design/native-app/index.html')).href);
  await page.evaluate(() => document.fonts.ready);
  await expectTitle('赛事');
  assert.match(await page.locator('h1').evaluate(element => getComputedStyle(element).fontFamily), /F1 UI Display/);
  assert.equal(await page.locator('#navigation button').count(), 4);
  assert.equal(await page.getByRole('img', { name: 'FrankPitwall', exact: true }).count(), 1);
  assert.equal(await page.locator('.brand-logo-light').isVisible(), true);
  assert.equal(await page.locator('.brand-logo-dark').isVisible(), false);
  assert.equal(await page.locator('.brand-logo-light').evaluate(image => image.complete && image.naturalWidth > 0), true);
  await page.locator('.wordmark').screenshot({ path: resolve(output, 'frankpitwall-header-light.png'), scale: 'css' });
  await page.screenshot({ path: resolve(output, 'home-mobile-viewport.png') });
  await page.screenshot({ path: resolve(output, 'home-mobile.png'), fullPage: true });
  await click('weekend');
  await expectTitle('比赛周末');
  assert.equal(await page.locator('#navigation').isVisible(), false);
  await click('race-tab', 'results');
  await click('session');
  await click('set-session', '排位赛');
  assert.match(await page.locator('#content').innerText(), /1:19.327/);
  await click('profile');
  await expectTitle('车手表现');
  await click('back');
  assert.equal(await page.locator('[data-action="session"]').innerText(), '排位赛');
  await click('session');
  await click('set-session', '正赛');
  await page.screenshot({ path: resolve(output, 'results-mobile.png'), fullPage: true });
  results.push('赛事 → 成绩 → 场次选择 → 车手 → 返回保持场次');

  await click('race-tab', 'analysis');
  await page.locator('[data-action="analysis"][data-type="lap"]').click();
  await expectTitle('圈速对比');
  await page.locator('#lap-select').fill('7');
  assert.match(await page.locator('#lap-values').innerText(), /第 7 圈/);
  await click('drivers');
  await click('set-driver', 'verstappen');
  assert.match(await page.locator('.legend').innerText(), /维斯塔潘/);
  await click('chart-table');
  await click('set-lap', '3');
  assert.match(await page.locator('#lap-values').innerText(), /第 3 圈/);
  await page.screenshot({ path: resolve(output, 'analysis-mobile.png'), fullPage: true });
  await click('back');
  await click('back');
  results.push('圈速选择、车手选择与可访问数据视图');

  await click('tab', 'standings');
  await click('standing', 'teams');
  await click('profile');
  await expectTitle('资料档案');
  await click('back');
  assert.equal(await page.locator('[data-action="standing"][data-value="teams"]').getAttribute('aria-selected'), 'true');
  await click('tab', 'library');
  await page.locator('#search').fill('zzzz');
  assert.match(await page.locator('#search-results').innerText(), /没有找到/);
  await page.locator('#search').fill('勒克莱尔');
  await click('archive');
  await click('back');
  assert.equal(await page.locator('#search').inputValue(), '勒克莱尔');
  results.push('榜单与资料返回保留分类和搜索词');

  await click('tab', 'me');
  await click('theme');
  await click('set-theme', 'dark');
  await click('timezone');
  await click('set-timezone', 'UTC');
  await click('tab', 'races');
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  assert.equal(await page.locator('.brand-logo-dark').isVisible(), true);
  assert.equal(await page.locator('.brand-logo-light').isVisible(), false);
  assert.equal(await page.locator('.brand-logo-dark').evaluate(image => image.complete && image.naturalWidth > 0), true);
  await page.locator('.wordmark').screenshot({ path: resolve(output, 'frankpitwall-header-dark.png'), scale: 'css' });
  assert.match(await page.locator('.race-time').innerText(), /13:00/);
  await page.screenshot({ path: resolve(output, 'home-dark-mobile.png') });
  await click('tab', 'me');
  await click('theme');
  await click('set-theme', 'light');
  await click('timezone');
  await click('set-timezone', 'Asia/Shanghai');
  results.push('主题与时区跨导航保持且实际更新时间');

  for (const mode of ['loading', 'empty', 'error', 'offline']) {
    await click('state');
    await click('set-state', mode);
    const body = await page.locator('#content').innerText();
    assert.match(body, { loading: /正在读取成绩/, empty: /成绩尚未发布/, error: /暂时无法更新/, offline: /当前离线/ }[mode]);
    if (mode === 'empty' || mode === 'error') {
      await click('retry');
      assert.equal(await page.locator('[data-action="profile"]').count(), 6);
    }
    await click('back');
    await click('tab', 'me');
  }
  await click('state');
  await click('set-state', 'normal');
  await click('back');
  results.push('加载、空数据、错误重试与离线状态');

  for (const width of [320, 360, 375, 412, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const tab of ['races', 'standings', 'library', 'me']) {
      await click('tab', tab);
      await noOverflow();
    }
    await click('tab', 'races');
    await click('results');
    await noOverflow();
    assert.equal(await page.locator('#content').evaluate(element => getComputedStyle(element).paddingLeft), '16px');
    await click('race-tab', 'analysis');
    await page.locator('[data-action="analysis"][data-type="lap"]').click();
    await noOverflow();
    await click('back');
    await click('back');
  }
  results.push('320/360/375/412/768/1440 px 主入口、成绩与分析无横向溢出');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: resolve(output, 'home-desktop.png'), fullPage: true });
  results.push('沿用网站字体并检查浅色/深色主界面');
  assert.deepEqual(errors, []);
  await writeFile(resolve(output, 'verification.json'), `${JSON.stringify({ status: 'passed', results, errors }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ status: 'passed', results, errors }, null, 2)}\n`);
} finally {
  await browser.close();
}
