import { readFile, readdir, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const distDir = path.resolve('dist');
const html = await readFile(path.join(distDir, 'index.html'), 'utf8');
const assetPaths = [...html.matchAll(/(?:src|href)="\/(assets\/[^"?]+\.js)"/g)]
  .map((match) => match[1]);
const uniqueAssets = [...new Set(assetPaths)];
let initialJsGzipBytes = 0;

for (const assetPath of uniqueAssets) {
  const bytes = await readFile(path.join(distDir, assetPath));
  initialJsGzipBytes += gzipSync(bytes).byteLength;
}

const initialBudget = 180 * 1024;
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
const homeAsset = assetNames.find((name) => /^Home-.*\.js$/.test(name));
if (!homeAsset) throw new Error('Home route chunk was not emitted');
const homeGzipBytes = gzipSync(await readFile(path.join(distDir, 'assets', homeAsset))).byteLength;
if (initialJsGzipBytes + homeGzipBytes > 140 * 1024) {
  throw new Error('Home critical JS path exceeds 140 KiB gzip');
}

const raceInfoGzipBytes = await routeStaticGzipBytes('src/pages/Race/RaceInfo.tsx');
if (raceInfoGzipBytes > 340 * 1024) {
  throw new Error(`Race Info critical JS path exceeds 340 KiB gzip: ${raceInfoGzipBytes}`);
}

const raceAnalysisGzipBytes = await routeStaticGzipBytes('src/pages/Race/RaceAnalysis.tsx');
if (raceAnalysisGzipBytes > 470 * 1024) {
  throw new Error(`Race Analysis shell exceeds 470 KiB gzip before viewport charts: ${raceAnalysisGzipBytes}`);
}

let largestAsyncGzipBytes = 0;
let largestAsyncName = '';
for (const name of assetNames.filter((asset) => asset.endsWith('.js'))) {
  const gzipBytes = gzipSync(await readFile(path.join(distDir, 'assets', name))).byteLength;
  if (gzipBytes > largestAsyncGzipBytes) {
    largestAsyncGzipBytes = gzipBytes;
    largestAsyncName = name;
  }
}
if (largestAsyncGzipBytes > 140 * 1024) {
  throw new Error(`JS chunk budget exceeded: ${largestAsyncName} is ${largestAsyncGzipBytes} bytes gzip`);
}

const serviceWorker = path.join(distDir, 'sw.js');
await stat(serviceWorker);
process.stdout.write(
  `Initial JS: ${(initialJsGzipBytes / 1024).toFixed(1)} KiB gzip; `
  + `Home path: ${((initialJsGzipBytes + homeGzipBytes) / 1024).toFixed(1)} KiB gzip; `
  + `Race Info: ${(raceInfoGzipBytes / 1024).toFixed(1)} KiB gzip; `
  + `Race Analysis shell: ${(raceAnalysisGzipBytes / 1024).toFixed(1)} KiB gzip; `
  + `largest chunk: ${largestAsyncName} ${(largestAsyncGzipBytes / 1024).toFixed(1)} KiB gzip; service worker present.\n`,
);
