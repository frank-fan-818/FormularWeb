import { readFile } from 'node:fs/promises';

const config = JSON.parse(await readFile('vercel.json', 'utf8'));
const routes = Array.isArray(config.routes) ? config.routes : [];
const failures = [];

const securityRoute = routes.find((route) => route.src === '/(.*)' && route.continue === true);
const filesystemIndex = routes.findIndex((route) => route.handle === 'filesystem');
const missingAssetIndex = routes.findIndex((route) => route.status === 404 && route.src?.includes('\\.'));
const spaIndex = routes.findIndex((route) => route.dest === '/index.html');
const apiProxyIndex = routes.findIndex((route) => route.src === '/f1-api/(.*)');
const apiProxyRoute = routes[apiProxyIndex];
const assetCacheRoute = routes.find((route) => route.src === '/assets/(.*)' && route.continue === true);
const serviceWorkerRoute = routes.find((route) => route.src === '/sw.js' && route.continue === true);

if (!securityRoute?.headers?.['Content-Security-Policy']
  || securityRoute.headers['X-Content-Type-Options'] !== 'nosniff') {
  failures.push('global CSP and nosniff headers must be applied before routing');
}
if (apiProxyIndex < 0 || apiProxyIndex > filesystemIndex) {
  failures.push('the same-origin F1 API proxy must run before filesystem/SPA fallback');
}
if (apiProxyRoute?.headers?.['Cache-Control'] !== 'public, s-maxage=300, stale-while-revalidate=86400') {
  failures.push('public F1 API responses must use a bounded shared edge cache');
}
if (filesystemIndex < 0
  || missingAssetIndex <= filesystemIndex
  || spaIndex <= missingAssetIndex) {
  failures.push('routing must check the filesystem, 404 missing file paths, then apply SPA fallback');
}
if (assetCacheRoute?.headers?.['Cache-Control'] !== 'public, max-age=31536000, immutable') {
  failures.push('hashed assets must use immutable caching');
}
if (serviceWorkerRoute?.headers?.['Cache-Control'] !== 'no-cache, no-store, must-revalidate') {
  failures.push('the service worker must never be served from an HTTP cache');
}

if (failures.length > 0) {
  throw new Error(`Deployment configuration verification failed:\n- ${failures.join('\n- ')}`);
}

console.log('Deployment configuration verification passed.');
