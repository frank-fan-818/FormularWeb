import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const baseUrl = process.env.QA_BASE_URL || 'http://127.0.0.1:5175';
const screenshotDirectory = path.resolve('docs/qa-screenshots/2026-07-18-sitewide-redesign');
const desktopRoutes = [
  '/',
  '/seasons',
  '/races',
  '/drivers',
  '/constructors',
  '/circuits',
  '/drivers/max_verstappen',
  '/constructors/red_bull',
  '/circuits/austin',
  '/races/1/results',
  '/settings',
  '/login',
];
const mobileRoutes = [
  '/',
  '/seasons',
  '/races',
  '/drivers',
  '/constructors',
  '/circuits',
  '/drivers/max_verstappen',
  '/constructors/red_bull',
  '/circuits/austin',
  '/settings',
  '/login',
];
const defaultRuns = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, routes: desktopRoutes },
  { name: 'tablet', viewport: { width: 768, height: 1024 }, routes: ['/', '/races', '/circuits/austin'] },
  { name: 'mobile', viewport: { width: 375, height: 812 }, routes: mobileRoutes },
];
const routesArgument = process.argv.find((argument) => argument.startsWith('--routes='))?.slice('--routes='.length);
const viewportArgument = process.argv.find((argument) => argument.startsWith('--viewport='))?.slice('--viewport='.length);
const viewportName = viewportArgument || process.env.QA_VIEWPORT || 'mobile';
const viewport = viewportName === 'desktop'
  ? { width: 1440, height: 900 }
  : viewportName === 'tablet'
    ? { width: 768, height: 1024 }
    : { width: 375, height: 812 };
const selectedRoutes = routesArgument || process.env.QA_ROUTES;
const runs = selectedRoutes
  ? [{ name: viewportName, viewport, routes: selectedRoutes.split(',').map((route) => route.trim()) }]
  : defaultRuns;

await fs.mkdir(screenshotDirectory, { recursive: true });

let viteProcess;
async function ensureServer() {
  try {
    const response = await fetch(baseUrl);
    if (response.ok) return;
  } catch {
    // Start a local Vite server for standalone QA runs.
  }

  viteProcess = spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5175', '--strictPort'],
    { cwd: process.cwd(), stdio: 'ignore' },
  );

  for (let attempt = 0; attempt < 40; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // Keep polling until Vite is ready.
    }
  }

  throw new Error(`Unable to start QA server at ${baseUrl}`);
}

await ensureServer();

const browser = await chromium.launch();
const report = [];

function routeSlug(route) {
  return route === '/' ? 'home' : route.replace(/^\//, '').replaceAll('/', '-');
}

try {
  for (const run of runs) {
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

      const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForTimeout(route.includes('/races/1/') ? 5_000 : 3_500);
      if (/^\/drivers\/[^/]+$/.test(route)) {
        await page.waitForSelector('.driver-profile-hero', { timeout: 20_000 });
      }
      if (/^\/constructors\/[^/]+$/.test(route)) {
        await page.waitForSelector('.constructor-profile-hero', { timeout: 20_000 });
      }
      if (/^\/circuits\/[^/]+$/.test(route)) {
        await page.waitForSelector('.product-masthead', { timeout: 20_000 });
      }
      if (['/', '/seasons', '/races', '/drivers', '/constructors', '/circuits', '/settings'].includes(route)) {
        await page.waitForSelector('.product-masthead', { timeout: 20_000 });
      }

      const measurements = await page.evaluate(() => ({
        pageOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        headingCount: document.querySelectorAll('h1').length,
        mastheadVisible: Boolean(document.querySelector('.product-masthead, .driver-profile-hero, .constructor-profile-hero, .race-command')),
        overflowingElements: [...document.querySelectorAll('body *')]
          .map((element) => ({ element, rect: element.getBoundingClientRect() }))
          .filter(({ rect }) => rect.right > window.innerWidth + 1 || rect.left < -1)
          .sort((left, right) => right.rect.width - left.rect.width)
          .slice(0, 8)
          .map(({ element, rect }) => ({
            selector: `${element.tagName.toLowerCase()}.${[...element.classList].join('.')}`,
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
          })),
      }));

      const screenshotPath = path.join(screenshotDirectory, `${run.name}-${routeSlug(route)}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });

      report.push({
        viewport: run.name,
        route,
        status: response?.status() || null,
        screenshotPath,
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
  viteProcess?.kill();
}

console.log(JSON.stringify(report, null, 2));

const blocking = report.filter((entry) => (
  !entry.status
  || entry.status >= 400
  || entry.pageOverflow
  || entry.pageErrors.length
));

if (blocking.length) {
  console.error(`Sitewide QA found ${blocking.length} blocking result(s).`);
  process.exitCode = 1;
}
