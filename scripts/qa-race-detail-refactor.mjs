import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.QA_BASE_URL || 'http://127.0.0.1:5175';
const outputDir = path.resolve('artifacts/browser-qa/race-detail-refactor');
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 812 },
];
const allRaceRoutes = [
  '/races/1/results',
  '/races/1/qualifying',
  '/races/1/race',
  '/races/2/sprint',
  '/races/1/info',
];
const raceRoutes = process.env.QA_ROUTE ? [process.env.QA_ROUTE] : allRaceRoutes;
const requestedViewport = process.env.QA_VIEWPORT;
const waitMs = Number(process.env.QA_WAIT_MS || 1200);
const supportOnly = process.env.QA_SUPPORT_ONLY === '1';
const supportingRoutes = supportOnly ? [
  '/drivers/max_verstappen',
  '/constructors/red_bull',
  '/circuits/albert_park',
] : [];

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const findings = [];

for (const viewport of supportOnly ? [] : viewports.filter((item) => !requestedViewport || item.name === requestedViewport)) {
  const context = await browser.newContext({ viewport });
  for (const route of raceRoutes) {
    const page = await context.newPage();
    const consoleProblems = [];
    const pageErrors = [];
    const failedRequests = [];
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') {
        consoleProblems.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('response', (response) => {
      if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`);
    });
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(waitMs);
    if (waitMs > 2000) {
      const telemetryAnchor = page.locator('#analysis-telemetry');
      if (await telemetryAnchor.count()) {
        await telemetryAnchor.evaluate((element) => element.scrollIntoView({ block: 'center' }));
        await page.waitForTimeout(1_500);
      }
      for (let pass = 0; pass < 2; pass += 1) {
        for (let attempt = 0; attempt < 16; attempt += 1) {
          const lazyChart = page.locator('.chart-viewport-placeholder').first();
          if (await lazyChart.count() === 0) break;
          await lazyChart.evaluate((element) => element.scrollIntoView({ block: 'center' }));
          await page.waitForTimeout(400);
        }
        await page.waitForTimeout(500);
      }
      const lazyTables = page.locator('.viewport-table-anchor');
      const lazyTableCount = await lazyTables.count();
      for (let index = 0; index < lazyTableCount; index += 1) {
        await lazyTables.nth(index).evaluate((element) => element.scrollIntoView({ block: 'center' }));
        await page.waitForTimeout(250);
      }
      await page.waitForFunction(
        () => document.querySelectorAll('.chart-viewport-placeholder').length === 0,
        undefined,
        { timeout: 10_000 },
      );
      await page.waitForFunction(
        () => document.querySelectorAll('.viewport-table-skeleton').length === 0,
        undefined,
        { timeout: 10_000 },
      );
    }
    const metrics = await page.evaluate(() => ({
      pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      bodyTextLength: document.body.innerText.trim().length,
      mainVisible: Boolean(document.querySelector('.race-detail-page')),
      chartCount: document.querySelectorAll('canvas').length,
      chartPlaceholderCount: document.querySelectorAll('.chart-viewport-placeholder').length,
      tableSkeletonCount: document.querySelectorAll('.viewport-table-skeleton').length,
      telemetryStatus: (() => {
        const telemetry = document.querySelector('#analysis-telemetry');
        if (!telemetry) return null;
        if (telemetry.querySelector('canvas')) return 'success';
        if (telemetry.querySelector('[role="alert"]')) return 'error';
        const emptyState = telemetry.querySelector('.race-weekend-empty');
        if (emptyState) return /加载|loading/i.test(emptyState.textContent || '') ? 'loading' : 'empty';
        return telemetry.querySelector('.ant-card') ? 'settled' : 'missing';
      })(),
    }));
    let sessionTabInteraction = null;
    if (viewport.name === 'mobile' && route.endsWith('/results')) {
      const tabs = page.locator('.race-session-tabs [role="tab"]');
      const count = await tabs.count();
      if (count > 1) {
        const before = await page.locator('.race-session-tabs [role="tab"][aria-selected="true"]').getAttribute('id');
        const secondTab = tabs.nth(1);
        const moreButton = page.locator('.race-session-tabs .ant-tabs-nav-more');
        const overflowButtonVisible = await moreButton.isVisible();
        let interaction = 'direct';
        if (overflowButtonVisible) {
          interaction = 'overflow-menu';
          await moreButton.click();
          await page.locator('.ant-tabs-dropdown-menu-item').first().click();
        } else {
          await secondTab.click();
        }
        await page.waitForTimeout(500);
        const after = await page.locator('.race-session-tabs [role="tab"][aria-selected="true"]').getAttribute('id');
        sessionTabInteraction = {
          count,
          before,
          after,
          changed: before !== after,
          interaction,
          overflowButtonVisible,
        };
      } else {
        sessionTabInteraction = { count, changed: false };
      }
    }
    if ((viewport.name === 'desktop' && ['/races/1/results', '/races/1/race'].includes(route))
      || (viewport.name === 'mobile' && ['/races/2/sprint', '/races/1/info'].includes(route))) {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.waitForTimeout(500);
      const name = `${viewport.name}-${route.split('/').filter(Boolean).join('-')}.png`;
      await page.screenshot({ path: path.join(outputDir, name), fullPage: true });
    }
    findings.push({
      viewport: viewport.name,
      route,
      status: response?.status() || null,
      ...metrics,
      sessionTabInteraction,
      consoleProblems,
      pageErrors,
      failedRequests,
    });
    await page.close();
  }
  await context.close();
}

const supportingContext = await browser.newContext({ viewport: viewports[0] });
for (const route of supportingRoutes) {
  const page = await supportingContext.newPage();
  const consoleProblems = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') consoleProblems.push(`${message.type()}: ${message.text()}`);
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(1_000);
  const metrics = await page.evaluate(() => ({
    pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    bodyTextLength: document.body.innerText.trim().length,
  }));
  findings.push({ viewport: 'desktop', route, status: response?.status() || null, ...metrics, consoleProblems, pageErrors });
  await page.close();
}
await supportingContext.close();
await browser.close();

const blockers = findings.filter((item) => item.status !== 200
  || item.pageOverflow
  || item.bodyTextLength < 40
  || item.mainVisible === false
  || item.consoleProblems.length
  || item.pageErrors.length
  || (waitMs > 2000 && item.chartPlaceholderCount > 0)
  || (waitMs > 2000 && item.tableSkeletonCount > 0)
  || (waitMs > 2000 && item.route.endsWith('/qualifying') && item.chartCount < 1)
  || (waitMs > 2000 && item.route.endsWith('/sprint') && item.chartCount < 1)
  || (waitMs > 2000 && item.route.endsWith('/race') && item.chartCount < 4)
  || (waitMs > 2000 && item.route.endsWith('/race') && ['loading', 'missing'].includes(item.telemetryStatus))
  || item.sessionTabInteraction?.changed === false);

console.log(JSON.stringify({ outputDir, count: findings.length, blockers, findings }, null, 2));
process.exitCode = blockers.length ? 1 : 0;
