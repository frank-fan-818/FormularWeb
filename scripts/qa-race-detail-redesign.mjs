import { chromium } from 'playwright';

const baseUrl = process.env.QA_BASE_URL || 'http://127.0.0.1:5174';
const raceRoutes = [
  '/races/1/results',
  '/races/1/qualifying',
  '/races/1/race',
  '/races/1/info',
  '/races/2/sprint',
];
const smokeRoutes = [
  '/',
  '/races',
  '/drivers/max_verstappen',
  '/constructors/red_bull',
  '/circuits/austin',
];
const viewportRuns = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, routes: [...raceRoutes, ...smokeRoutes] },
  { name: 'tablet', viewport: { width: 768, height: 1024 }, routes: ['/races/1/results', '/races/1/race', '/races/1/info'] },
  { name: 'mobile', viewport: { width: 375, height: 812 }, routes: raceRoutes },
];
const selectedRuns = process.env.QA_ROUTE
  ? [{
      name: process.env.QA_VIEWPORT || 'mobile',
      viewport: process.env.QA_VIEWPORT === 'desktop'
        ? { width: 1440, height: 900 }
        : { width: 375, height: 812 },
      routes: [process.env.QA_ROUTE],
    }]
  : viewportRuns;

const browser = await chromium.launch();
const report = [];

try {
  for (const run of selectedRuns) {
    const context = await browser.newContext({
      viewport: run.viewport,
      colorScheme: 'light',
      locale: 'zh-CN',
      timezoneId: 'Asia/Shanghai',
    });

    for (const route of run.routes) {
      const page = await context.newPage();
      const consoleErrors = [];
      const pageErrors = [];
      const failedRequests = [];

      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      page.on('pageerror', (error) => pageErrors.push(error.message));
      page.on('requestfailed', (request) => {
        failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || 'failed'}`);
      });

      const response = await page.goto(`${baseUrl}${route}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });

      if (route.startsWith('/races/') && route.split('/').length > 3) {
        await page.waitForSelector('.race-command', { timeout: 20_000 });
      }
      await page.waitForTimeout(2500);

      if (route.includes('/race') || route.includes('/qualifying') || route.includes('/sprint')) {
        await page.evaluate(async () => {
          const step = Math.max(480, Math.floor(window.innerHeight * 0.72));
          for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
            window.scrollTo(0, y);
            await new Promise((resolve) => window.setTimeout(resolve, 90));
          }
        });
        await page.waitForTimeout(1800);
      }

      const measurements = await page.evaluate(() => {
        const mainTabs = document.querySelector('.race-subpage-tabs');
        const analysisNav = document.querySelector('.analysis-section-nav');
        const mainRect = mainTabs?.getBoundingClientRect();
        const analysisRect = analysisNav?.getBoundingClientRect();
        const stickyOverlap = Boolean(
          mainRect
          && analysisRect
          && mainRect.bottom > analysisRect.top
          && mainRect.top >= 0
          && analysisRect.top >= 0,
        );

        return {
          pageOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
          overflowingElements: [...document.querySelectorAll('body *')]
            .map((element) => ({ element, rect: element.getBoundingClientRect() }))
            .filter(({ rect }) => rect.right > window.innerWidth + 1)
            .sort((left, right) => right.rect.right - left.rect.right)
            .slice(0, 12)
            .map(({ element, rect }) => ({
              selector: `${element.tagName.toLowerCase()}.${[...element.classList].join('.')}`,
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              width: Math.round(rect.width),
            })),
          stickyOverlap,
          chartCanvases: document.querySelectorAll('.echarts-for-react canvas').length,
          commandVisible: Boolean(document.querySelector('.race-command')),
        };
      });

      report.push({
        viewport: run.name,
        route,
        status: response?.status() || null,
        ...measurements,
        consoleErrors,
        pageErrors,
        failedRequests,
      });
      await page.close();
    }

    await context.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(report, null, 2));

const blocking = report.filter((entry) => (
  !entry.status
  || entry.status >= 400
  || entry.pageOverflow
  || entry.stickyOverlap
  || entry.consoleErrors.length
  || entry.pageErrors.length
));

if (blocking.length) {
  console.error(`RaceDetail QA found ${blocking.length} blocking result(s).`);
  process.exitCode = 1;
}
