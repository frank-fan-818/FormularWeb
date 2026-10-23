import { expect, test } from '@playwright/test';
import { enterAsGuest } from './auth-fixtures';

const rss = (items: string) => `<?xml version="1.0"?><rss version="2.0"><channel><title>F1</title>${items}</channel></rss>`;
const item = (title: string, link: string, date = 'Wed, 21 Oct 2026 08:00:00 GMT', description = 'The teams are preparing for the next race weekend. This source introduction gives a brief overview of the latest developments.') =>
  `<item><title><![CDATA[${title}]]></title><link>${link.replace(/&/g, '&amp;')}</link><pubDate>${date}</pubDate><description><![CDATA[${description}]]></description></item>`;
const atom = (entries: string) => `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>formula1</title>${entries}</feed>`;
const redditTarget = 'https://www.reddit.com/r/formula1/comments/1x38muu/2026_singapore_grand_prix_postrace_discussion/';
const redditEntry = (title: string, url: string, published = '2026-10-21T07:59:59Z') => `<entry><title><![CDATA[${title}]]></title><link href="${url.replace(/&/g, '&amp;')}"/><published>${published}</published><updated>2026-10-21T09:00:00Z</updated><content type="html">&lt;img src="https://evil.test/tracker" /&gt;</content></entry>`;
const feeds: Record<string, string> = {
  motorsport: rss(item('Inside the next generation of Formula 1 engineering and the teams preparing for a closely fought championship', 'https://www.motorsport.com/f1/news/engineering/', 'Wed, 21 Oct 2026 09:00:00 GMT') + Array.from({ length: 17 }, (_, i) => item(`Ferrari development briefing ${i + 1}`, `https://www.motorsport.com/f1/news/update-${i}/?utm_source=RSS`)).join('')),
  fia: rss(item('FIA confirms F1 regulations update', 'https://www.fia.com/news/f1-update') + item('World Rally update', 'https://www.fia.com/news/wrc')),
  reddit: atom(Array.from({ length: 50 }, (_, i) => redditEntry(
    i === 0 ? '2026 Singapore Grand Prix - Post-Race Discussion' : i === 1 ? '2026 Belgian GP - Day After Debrief' : `Formula 1 community discussion ${i + 1}`,
    i === 0 ? redditTarget : `https://www.reddit.com/r/formula1/comments/qa${i + 100}/discussion/`,
    new Date(Date.parse('2026-10-21T07:59:59Z') - i * 60_000).toISOString(),
  )).join('')),
};

test.beforeEach(async ({ page }) => {
  await enterAsGuest(page);
  await page.clock.setFixedTime(new Date('2026-10-21T10:00:00Z'));
  await page.addInitScript(() => {
    localStorage.setItem('i18nextLng', 'zh-CN');
    if (!localStorage.getItem('f1-dashboard-storage')) localStorage.setItem('f1-dashboard-storage', JSON.stringify({ version: 3, state: {
      currentSeason: '2026', theme: 'light', sidebarCollapsed: false, timeZoneOffsetMinutes: 480, features: {},
    } }));
  });
  await page.route('**/f1-api/**', route => route.fulfill({ json: { MRData: {
    total: route.request().url().includes('seasons.json') ? '1' : '0',
    SeasonTable: { Seasons: [{ season: '2026' }] }, RaceTable: { Races: [] }, StandingsTable: { StandingsLists: [] },
  } } }));
  await page.route('**/rest/v1/**', route => route.fulfill({ json: [] }));
  await page.route('**/news-feed/*', route => route.fulfill({ contentType: 'application/rss+xml', body: feeds[new URL(route.request().url()).pathname.split('/').pop()!] }));
});

test('news supports guest reading, filtering, original links and responsive layouts', async ({ page }, info) => {
  const errors: string[] = [];
  const failures: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (['error', 'warning'].includes(message.type()) && !message.text().includes('Service Worker registration blocked by Playwright')) errors.push(message.text());
  });
  page.on('requestfailed', request => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') failures.push(request.url()); });
  await page.goto('/news');
  await expect(page.getByRole('heading', { name: 'PADDOCK JOURNAL', exact: true })).toBeVisible();
  await expect(page.getByText('69 条消息', { exact: true })).toBeVisible();
  await expect(page.locator('.news-entry')).toHaveCount(15);
  await expect(page.locator('.news-source-times')).toHaveCount(0);
  await expect(page.locator('.news-sidebar, .news-masthead .product-metric-rail')).toHaveCount(0);
  await expect(page.locator('.news-entry').first()).toContainText('17:00');
  await expect(page.locator('.news-entry').first().getByRole('link', { name: '查看原文' })).toHaveAttribute('href', 'https://www.motorsport.com/f1/news/engineering/');
  expect(await page.locator('.news-entry h2 a').evaluateAll(links => links.every(link => !(link as HTMLAnchorElement).href.includes('utm_')))).toBe(true);
  await page.screenshot({ path: `artifacts/browser-qa/screenshots/news-${info.project.name}.png`, animations: 'disabled' });
  await page.locator('.news-toolbar').screenshot({ path: `artifacts/browser-qa/screenshots/news-toolbar-all-${info.project.name}.png`, animations: 'disabled' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: '加载更多', exact: true }).click();
  await expect(page.locator('.news-entry')).toHaveCount(30);
  await page.getByRole('button', { name: '官方公告', exact: true }).click();
  await expect(page.locator('.news-entry')).toHaveCount(1);
  await expect(page.locator('.news-entry')).toContainText('FIA confirms');
  await page.getByRole('button', { name: 'Reddit 帖子', exact: true }).click();
  await expect(page.locator('.curated-post')).toHaveCount(15);
  await page.locator('.news-toolbar').screenshot({ path: `artifacts/browser-qa/screenshots/news-toolbar-reddit-${info.project.name}.png`, animations: 'disabled' });
  await page.getByRole('button', { name: '全部', exact: true }).click();
  await page.getByRole('combobox', { name: '来源', exact: true }).selectOption('fia');
  await expect(page.locator('.news-entry')).toHaveCount(1);
  await page.getByRole('searchbox', { name: '搜索标题' }).fill('missing-keyword');
  await expect(page.getByText('暂无符合条件的消息', { exact: true })).toBeVisible();
  await page.getByRole('searchbox', { name: '搜索标题' }).fill('F1');
  await expect(page.locator('.news-entry')).toHaveCount(1);
  await page.getByRole('searchbox', { name: '搜索标题' }).fill('');
  await page.getByRole('button', { name: '新闻', exact: true }).click();
  await expect(page.getByRole('combobox', { name: '来源', exact: true })).toHaveValue('all');
  await expect(page.locator('.news-entry')).toHaveCount(15);
  // The existing shell exposes its header language selector on desktop.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('.lang-switcher select').selectOption('en');
  await expect(page.getByRole('heading', { name: 'PADDOCK JOURNAL', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Refresh news', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
});

test('news titles and original links open the publisher directly without a reader page', async ({ page, context }) => {
  const target = 'https://www.motorsport.com/f1/news/engineering/';
  await context.route('https://www.motorsport.com/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Publisher page fixture</h1>' }));
  await page.goto('/news');
  const first = page.locator('.news-entry').first();
  await expect(first.locator('h2 a')).toHaveAttribute('href', target);
  await expect(first.locator('h2 a')).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(page.getByRole('link', { name: '查看导读' })).toHaveCount(0);
  await expect(page.locator('a[href^="/news/read"], .news-reader-summary, iframe')).toHaveCount(0);
  for (const link of [first.locator('h2 a'), first.getByRole('link', { name: '查看原文' })]) {
    const popupPromise = page.waitForEvent('popup');
    await link.click();
    const popup = await popupPromise;
    await expect(popup).toHaveURL(target);
    await popup.close();
    await expect(page).toHaveURL('/news');
  }
});

test('news retains last good source contents when a refresh fails', async ({ page }) => {
  let failed = false;
  await page.route('**/news-feed/*', route => failed
    ? route.fulfill({ contentType: 'text/html', body: '<html>Temporarily unavailable</html>' })
    : route.fulfill({ contentType: 'application/rss+xml', body: feeds[new URL(route.request().url()).pathname.split('/').pop()!] }));
  await page.goto('/news');
  await expect(page.getByText('69 条消息', { exact: true })).toBeVisible();
  failed = true;
  await page.getByRole('button', { name: '刷新动态', exact: true }).click();
  await expect(page.locator('.news-notice')).toBeVisible();
  await expect(page.locator('.news-entry')).toHaveCount(15);
  await expect(page.locator('.news-sidebar, .news-masthead .product-metric-rail')).toHaveCount(0);
});

test('news paints fast sources while a slow source and its filtered view remain loading', async ({ page }, info) => {
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/news-feed/fia', async route => {
    await held;
    await route.fulfill({ contentType: 'application/rss+xml', body: feeds.fia });
  });
  try {
    await page.goto('/news');
    await expect(page.getByText('68 条消息', { exact: true })).toBeVisible();
    await expect(page.locator('.news-entry')).toHaveCount(15);
    await expect(page.getByRole('button', { name: '正在更新', exact: true })).toBeDisabled();
    await page.screenshot({ path: `artifacts/browser-qa/screenshots/news-progressive-${info.project.name}.png`, animations: 'disabled' });
    await page.getByRole('button', { name: '官方公告', exact: true }).click();
    await expect(page.getByText('正在获取围场动态', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '暂无符合条件的消息' })).toHaveCount(0);
    release();
    await expect(page.locator('.news-entry')).toContainText('FIA confirms');
    await expect(page.getByText('正在获取围场动态', { exact: true })).toHaveCount(0);
  } finally {
    release();
    await page.unrouteAll({ behavior: 'wait' });
  }
});

test('news restores all source caches on reload before background updates and preserves retrieval times after failure', async ({ page }, info) => {
  await page.goto('/news');
  await expect(page.getByText('69 条消息', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '刷新动态', exact: true })).toBeEnabled();
  const readCachedFeeds = () => page.evaluate(() =>
    ['f1-news-feed-motorsport-v1', 'f1-news-feed-fia-v1', 'f1-reddit-feed-v1'].map(key => localStorage.getItem(key)));
  const cachedFeeds = await readCachedFeeds();
  expect(cachedFeeds.every(Boolean)).toBe(true);
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/news-feed/*', async route => {
    await held;
    await route.fulfill({ contentType: 'text/html', body: '<html>Unavailable</html>' });
  });
  try {
    await page.reload();
    await expect(page.getByText('69 条消息', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '正在更新', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: '官方公告', exact: true }).click();
    await expect(page.locator('.news-entry')).toContainText('FIA confirms');
    await page.getByRole('button', { name: '全部', exact: true }).click();
    await page.screenshot({ path: `artifacts/browser-qa/screenshots/news-cached-${info.project.name}.png`, animations: 'disabled' });
    release();
    await expect(page.locator('.news-notice')).toContainText('Motorsport.com');
    await expect(page.getByRole('button', { name: '刷新动态', exact: true })).toBeEnabled();
    expect(await readCachedFeeds()).toEqual(cachedFeeds);
    await expect(page.getByText('69 条消息', { exact: true })).toBeVisible();
  } finally {
    release();
    await page.unrouteAll({ behavior: 'wait' });
  }
});

test('news distinguishes total failure, partial failure, valid empty feeds and recovery', async ({ page }) => {
  let mode: 'failed' | 'partial' | 'empty' = 'failed';
  await page.route('**/news-feed/*', route => {
    const source = new URL(route.request().url()).pathname.split('/').pop()!;
    return route.fulfill(mode === 'failed' || (mode === 'partial' && source !== 'fia')
      ? { contentType: 'application/xml', body: '<html>Not RSS</html>' }
      : { contentType: 'application/xml', body: mode === 'empty' ? (source === 'reddit' ? atom('') : rss('')) : feeds[source] });
  });
  await page.goto('/news');
  await expect(page.getByText('暂时无法获取新闻', { exact: true })).toBeVisible();
  mode = 'partial';
  await page.getByRole('button', { name: '重新获取', exact: true }).click();
  await expect(page.locator('.news-entry')).toHaveCount(1);
  await expect(page.locator('.news-notice')).toContainText('Motorsport.com');
  mode = 'empty';
  await page.getByRole('button', { name: '刷新动态', exact: true }).click();
  await expect(page.getByText('暂无符合条件的消息', { exact: true })).toBeVisible();
  await expect(page.locator('.news-notice')).toHaveCount(0);
});

test('news parses real browser XML without rendering upstream markup or unsafe links', async ({ page }) => {
  const attacks: string[] = [];
  page.on('request', request => { if (new URL(request.url()).hostname === 'evil.test') attacks.push(request.url()); });
  await page.route('**/news-feed/*', route => route.fulfill({ contentType: 'application/rss+xml', body: rss(
    item('<img src="https://evil.test/track" onerror="window.newsInjected=true">Safe &amp; sound <script>window.newsInjected=true</script>', 'https://www.motorsport.com/f1/news/safe/')
      + item('Unsafe link', 'javascript:alert(1)')
      + item('Unknown host', 'https://evil.test/')
      + item('Missing date', 'https://www.motorsport.com/f1/news/missing/', 'invalid')
      + item('Old duplicate', 'https://www.motorsport.com/f1/news/safe/?utm_source=RSS', 'Tue, 20 Oct 2026 08:00:00 GMT')
  ) }));
  await page.goto('/news');
  await expect(page.locator('.news-entry')).toHaveCount(1);
  await expect(page.locator('.news-entry h2')).toContainText('Safe &amp; sound');
  await expect(page.locator('.news-entry img, .news-entry script')).toHaveCount(0);
  expect(await page.evaluate(() => Reflect.get(window, 'newsInjected'))).toBeUndefined();
  expect(attacks).toEqual([]);
});

test('news follows the stored time zone and renders its dark theme', async ({ page }, info) => {
  await page.addInitScript(() => {
    const stored = JSON.parse(localStorage.getItem('f1-dashboard-storage')!);
    stored.state.timeZoneOffsetMinutes = -300;
    stored.state.theme = 'dark';
    localStorage.setItem('f1-dashboard-storage', JSON.stringify(stored));
  });
  await page.goto('/news');
  await expect(page.locator('.news-entry').first()).toContainText('04:00 UTC-5');
  await expect(page.locator('html')).toHaveClass(/dark-mode/);
  await page.screenshot({ path: `artifacts/browser-qa/screenshots/news-dark-${info.project.name}.png`, animations: 'disabled' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

test('news curated posts support search and open original Reddit posts directly', async ({ page, context }, info) => {
  const errors: string[] = [];
  const failures: string[] = [];
  const redditRequests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (['error', 'warning'].includes(message.type()) && !message.text().includes('Service Worker registration blocked by Playwright')) errors.push(message.text());
  });
  page.on('requestfailed', request => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') failures.push(request.url()); });
  await context.route('https://www.reddit.com/**', route => {
    redditRequests.push(route.request().url());
    return route.fulfill({ contentType: 'text/html', body: '<h1>Reddit post fixture</h1>' });
  });
  await page.goto('/news');
  await page.getByRole('button', { name: 'Reddit 帖子', exact: true }).click();
  await expect(page).toHaveURL('/news?category=social');
  await expect(page.locator('.curated-post')).toHaveCount(15);
  await expect(page.locator('.curated-post p, .curated-heading, iframe, a[href^="/news/picks/"]')).toHaveCount(0);
  await expect(page.locator('.curated-post h3 a').first()).toHaveText('2026 Singapore Grand Prix - Post-Race Discussion ↗');
  await expect(page.locator('.curated-post time').first()).toHaveAttribute('datetime', '2026-10-21T07:59:59.000Z');
  await page.getByRole('button', { name: '加载更多', exact: true }).click();
  await expect(page.locator('.curated-post')).toHaveCount(30);
  await page.getByRole('button', { name: '加载更多', exact: true }).click();
  await page.getByRole('button', { name: '加载更多', exact: true }).click();
  await expect(page.locator('.curated-post')).toHaveCount(50);
  await expect(page.getByRole('button', { name: '加载更多', exact: true })).toHaveCount(0);
  await expect(page.getByText('3 条精选帖子', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: `artifacts/browser-qa/screenshots/news-picks-${info.project.name}.png`, animations: 'disabled' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.getByRole('searchbox', { name: '搜索标题' }).fill('belgian');
  await expect(page.locator('.curated-post')).toHaveCount(1);
  await page.getByRole('searchbox', { name: '搜索标题' }).fill('no-such-pick');
  await expect(page.getByRole('heading', { name: '暂无符合条件的消息' })).toBeVisible();
  await page.getByRole('searchbox', { name: '搜索标题' }).fill('');
  expect(redditRequests).toEqual([]);
  const target = 'https://www.reddit.com/r/formula1/comments/1x38muu/2026_singapore_grand_prix_postrace_discussion/';
  const first = page.locator('.curated-post').first();
  for (const link of [first.locator('h3 a'), first.getByRole('link', { name: '打开原帖' })]) {
    await expect(link).toHaveAttribute('href', target);
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    const popupPromise = page.waitForEvent('popup');
    await link.click();
    const popup = await popupPromise;
    await expect(popup).toHaveURL(target);
    await popup.close();
    await expect(page).toHaveURL('/news?category=social');
  }
  await page.reload();
  await expect(page.getByRole('button', { name: 'Reddit 帖子', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('.lang-switcher select').selectOption('en');
  await expect(page.getByRole('link', { name: '2026 Singapore Grand Prix - Post-Race Discussion' })).toHaveAttribute('href', target);
  await expect(page.locator('.curated-post p')).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
});

test('news Reddit posts survive an outage and reload using last good data in dark mode', async ({ page }, info) => {
  await page.addInitScript(() => {
    const stored = JSON.parse(localStorage.getItem('f1-dashboard-storage')!);
    stored.state.theme = 'dark';
    localStorage.setItem('f1-dashboard-storage', JSON.stringify(stored));
  });
  await page.goto('/news?category=social');
  await expect(page.locator('.curated-post')).toHaveCount(15);
  await page.route('**/news-feed/*', route => route.fulfill({ status: 503 }));
  await page.reload();
  await expect(page.locator('.news-notice')).toContainText('Reddit');
  await expect(page.locator('.curated-post')).toHaveCount(15);
  await expect(page.locator('.curated-post h3 a').first()).toHaveAttribute('href', /^https:\/\/www\.reddit\.com\/r\/formula1\/comments\//);
  await expect(page.locator('html')).toHaveClass(/dark-mode/);
  await expect(page.locator('iframe, .curated-post p')).toHaveCount(0);
  await page.screenshot({ path: `artifacts/browser-qa/screenshots/news-picks-dark-${info.project.name}.png`, animations: 'disabled' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

test('news Reddit feed updates automatically without reloading the page', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-21T10:00:00Z') });
  let updated = false;
  await page.route('**/news-feed/reddit', route => route.fulfill({ contentType: 'application/atom+xml', body: updated
    ? atom(redditEntry('New community race discussion', 'https://www.reddit.com/r/formula1/comments/new123/new_discussion/', '2026-10-21T09:30:00Z'))
    : feeds.reddit }));
  await page.goto('/news?category=social');
  await expect(page.locator('.curated-post')).toHaveCount(15);
  updated = true;
  await page.clock.fastForward(5 * 60_000 + 1);
  await expect(page.locator('.curated-post')).toHaveCount(1);
  await expect(page.locator('.curated-post h3 a')).toHaveText('New community race discussion ↗');
  await expect(page.locator('.curated-post time')).toHaveAttribute('datetime', '2026-10-21T09:30:00.000Z');
});

test('news Reddit rejects unsafe Atom entries and distinguishes unavailable from empty feeds', async ({ page }) => {
  const attacks: string[] = [];
  page.on('request', request => { if (new URL(request.url()).hostname === 'evil.test') attacks.push(request.url()); });
  let body = atom(redditEntry('<img src="https://evil.test/tracker" onerror="alert(1)">Safe Reddit title', redditTarget)
    + redditEntry('Wrong community', 'https://www.reddit.com/r/other/comments/abc123/title/')
    + redditEntry('External host', 'https://evil.test/story')
    + redditEntry('Future date', 'https://www.reddit.com/r/formula1/comments/future/title/', '2027-01-01T00:00:00Z')
    + '<entry><title>No publication date</title><link href="https://www.reddit.com/r/formula1/comments/nodate/title/"/><updated>2026-10-21T09:00:00Z</updated></entry>');
  await page.route('**/news-feed/reddit', route => route.fulfill({ contentType: 'application/atom+xml', body }));
  await page.goto('/news?category=social');
  await expect(page.locator('.curated-post')).toHaveCount(1);
  await expect(page.locator('.curated-post h3')).toContainText('Safe Reddit title');
  await expect(page.locator('.curated-post img, .curated-post script')).toHaveCount(0);
  expect(attacks).toEqual([]);
  body = atom('');
  await page.getByRole('button', { name: '刷新动态', exact: true }).click();
  await expect(page.getByRole('heading', { name: '暂无符合条件的消息' })).toBeVisible();
  await page.route('**/news-feed/reddit', route => route.fulfill({ status: 503 }));
  await page.evaluate(() => localStorage.removeItem('f1-reddit-feed-v1'));
  await page.reload();
  await expect(page.getByRole('heading', { name: '暂时无法获取新闻' })).toBeVisible();
  await expect(page.locator('.curated-post')).toHaveCount(0);
  body = atom(redditEntry('Recovered post', redditTarget));
  await page.unroute('**/news-feed/reddit');
  await page.route('**/news-feed/reddit', route => route.fulfill({ contentType: 'application/atom+xml', body }));
  await page.getByRole('button', { name: '重新获取', exact: true }).click();
  await expect(page.locator('.curated-post h3')).toContainText('Recovered post');
});
