import { readFile, readdir, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const distDir = path.resolve('dist');
const html = await readFile(path.join(distDir, 'index.html'), 'utf8');
if (/<link\b[^>]*rel=["']stylesheet["']/i.test(html)) {
  throw new Error('Critical CSS must be inlined; render-blocking stylesheet links remain in dist/index.html');
}
if (!/<style\b[^>]*data-critical-css/i.test(html)) {
  throw new Error('Critical CSS marker is missing from dist/index.html');
}
if (!html.includes('--motion-duration-route') || !html.includes('prefers-reduced-motion')) {
  throw new Error('The production shell is missing the global motion system or reduced-motion contract');
}
const criticalCssBytes = [...html.matchAll(/<style\b[^>]*data-critical-css[^>]*>([\s\S]*?)<\/style>/gi)]
  .reduce((total, match) => total + Buffer.byteLength(match[1]), 0);
if (criticalCssBytes > 48 * 1024) {
  throw new Error(`Inlined critical CSS exceeds 48 KiB raw: ${criticalCssBytes} bytes`);
}
const assetPaths = [...html.matchAll(/(?:src|href)="\/(assets\/[^"?]+\.js)"/g)]
  .map((match) => match[1]);
const uniqueAssets = [...new Set(assetPaths)];
let initialJsGzipBytes = 0;

for (const assetPath of uniqueAssets) {
  const bytes = await readFile(path.join(distDir, assetPath));
  initialJsGzipBytes += gzipSync(bytes).byteLength;
}

const initialBudget = 85 * 1024;
if (initialJsGzipBytes > initialBudget) {
  throw new Error(`Initial JS budget exceeded: ${initialJsGzipBytes} > ${initialBudget} bytes gzip`);
}

const assetNames = await readdir(path.join(distDir, 'assets'));
const manifest = JSON.parse(await readFile(path.join(distDir, '.vite', 'manifest.json'), 'utf8'));

async function routeStaticGzipBytes(sourceSuffix) {
  const routeEntry = Object.entries(manifest)
    .find(([key, value]) => key.endsWith(sourceSuffix) || value.src?.endsWith(sourceSuffix));
  if (!routeEntry) throw new Error(`Route chunk was not emitted for ${sourceSuffix}`);
  const visited = new Set(uniqueAssets);
  const visit = (manifestKey) => {
    const item = manifest[manifestKey];
    if (!item) return;
    if (item.file?.endsWith('.js')) visited.add(item.file);
    (item.imports || []).forEach(visit);
  };
  visit(routeEntry[0]);
  let total = 0;
  for (const file of visited) {
    total += gzipSync(await readFile(path.join(distDir, file))).byteLength;
  }
  return total;
}
const homeRouteEntry = Object.entries(manifest)
  .find(([key, value]) => key.endsWith('src/pages/Home.tsx') || value.src?.endsWith('src/pages/Home.tsx'));
const homeCriticalGzipBytes = homeRouteEntry
  ? await routeStaticGzipBytes('src/pages/Home.tsx')
  : initialJsGzipBytes;
if (!homeRouteEntry && !manifest['index.html']?.isEntry) {
  throw new Error('Home is neither a route chunk nor part of the verified application entry.');
}
if (homeCriticalGzipBytes > 92 * 1024) {
  throw new Error('Home critical JS path exceeds 92 KiB gzip');
}

const raceInfoGzipBytes = await routeStaticGzipBytes('src/pages/Race/RaceInfo.tsx');
if (raceInfoGzipBytes > 325 * 1024) {
  throw new Error(`Race Info critical JS path exceeds 325 KiB gzip: ${raceInfoGzipBytes}`);
}

const raceAnalysisGzipBytes = await routeStaticGzipBytes('src/pages/Race/RaceAnalysis.tsx');
if (raceAnalysisGzipBytes > 450 * 1024) {
  throw new Error(`Race Analysis shell exceeds 450 KiB gzip before viewport charts: ${raceAnalysisGzipBytes}`);
}

let largestAsyncGzipBytes = 0;
let largestAsyncName = '';
let chartRuntimeGzipBytes = 0;
for (const name of assetNames.filter((asset) => asset.endsWith('.js'))) {
  const gzipBytes = gzipSync(await readFile(path.join(distDir, 'assets', name))).byteLength;
  if (/^(?:chart-vendor|EChartsPanel)-/.test(name)) chartRuntimeGzipBytes += gzipBytes;
  if (gzipBytes > largestAsyncGzipBytes) {
    largestAsyncGzipBytes = gzipBytes;
    largestAsyncName = name;
  }
}
if (chartRuntimeGzipBytes > 200 * 1024) {
  throw new Error(`Custom ECharts runtime exceeds 200 KiB gzip: ${chartRuntimeGzipBytes}`);
}
if (largestAsyncGzipBytes > 140 * 1024) {
  throw new Error(`JS chunk budget exceeded: ${largestAsyncName} is ${largestAsyncGzipBytes} bytes gzip`);
}

const serviceWorker = path.join(distDir, 'sw.js');
await stat(serviceWorker);
process.stdout.write(
  `Initial JS: ${(initialJsGzipBytes / 1024).toFixed(1)} KiB gzip; `
  + `Home path: ${(homeCriticalGzipBytes / 1024).toFixed(1)} KiB gzip; `
  + `Race Info: ${(raceInfoGzipBytes / 1024).toFixed(1)} KiB gzip; `
  + `Race Analysis shell: ${(raceAnalysisGzipBytes / 1024).toFixed(1)} KiB gzip; `
  + `custom ECharts: ${(chartRuntimeGzipBytes / 1024).toFixed(1)} KiB gzip; `
  + `largest chunk: ${largestAsyncName} ${(largestAsyncGzipBytes / 1024).toFixed(1)} KiB gzip; service worker present.\n`,
);
