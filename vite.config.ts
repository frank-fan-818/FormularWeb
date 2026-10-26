import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'
import type { OutputBundle, OutputChunk } from 'rollup'
import react from '@vitejs/plugin-react'
import path from 'path'
import { createHash } from 'node:crypto'
import { Agent as HttpsAgent } from 'node:https'
import { existsSync, readFileSync } from 'node:fs'
import pitStopsHandler from './api/pit-stops.mjs'
import { createRaceWeatherHandler } from './api/race-weather.mjs'

function raceWeatherApi(): Plugin {
  const configure = (server: Pick<ViteDevServer, 'middlewares' | 'config'>) => {
    const handler = createRaceWeatherHandler({ env: { ...loadEnv(server.config.mode, process.cwd(), ''), ...process.env } });
    server.middlewares.use((req, res, next) => {
      if ((req.url || '').split('?')[0] !== '/api/race-weather') return next();
      void handler(req, res);
    });
  };
  return { name: 'race-weather-api', configureServer: configure, configurePreviewServer: configure };
}

function pitStopsApi(): Plugin {
  const configure = (server: Pick<ViteDevServer, 'middlewares'>) => {
    server.middlewares.use((req, res, next) => {
      if ((req.url || '').split('?')[0] !== '/api/pit-stops') return next();
      void pitStopsHandler(req, res);
    });
  };
  return { name: 'pit-stops-api', configureServer: configure, configurePreviewServer: configure };
}

const newsFeedUpstreams: Record<string, string> = JSON.parse(readFileSync(path.resolve(__dirname, 'config/news-feeds.json'), 'utf8'));
const newsFeedAgent = new HttpsAgent({ keepAlive: true, proxyEnv: process.env });
const newsFeedProxy = Object.fromEntries(Object.entries(newsFeedUpstreams).map(([id, upstream]) => {
  const url = new URL(upstream);
  return [`/news-feed/${id}`, { target: url.origin, changeOrigin: true, secure: true, agent: newsFeedAgent,
    headers: { 'User-Agent': 'FormularOneWeb/1.2 (F1 feed reader)', Accept: 'application/atom+xml, application/rss+xml, application/xml, text/xml' },
    rewrite: () => `${url.pathname}${url.search}` }];
}));

function newsFeedGuard(): Plugin {
  const configure = (server: Pick<ViteDevServer, 'middlewares'>) => {
    server.middlewares.use((req, res, next) => {
      const pathname = (req.url || '').split('?')[0];
      if ((pathname === '/news-feed' || pathname.startsWith('/news-feed/'))
        && (!Object.hasOwn(newsFeedProxy, pathname) || !['GET', 'HEAD'].includes(req.method || ''))) {
        res.writeHead(404); res.end(); return;
      }
      next();
    });
  };
  return { name: 'fixed-news-feed-boundary', configureServer: configure, configurePreviewServer: configure };
}

const f1ApiProxy = {
  '/f1-api': {
    target: 'https://api.jolpi.ca',
    changeOrigin: true,
    secure: true,
    rewrite: (requestPath: string) => requestPath.replace(/^\/f1-api/, '/ergast/f1'),
  },
}

function privateDataGuard(): Plugin {
  const rejectPublicData = (server: { middlewares: { use: (handler: (req: { url?: string }, res: { writeHead: (status: number) => void; end: () => void }, next: () => void) => void) => void } }) => {
    server.middlewares.use((req, res, next) => {
      const pathname = decodeURIComponent((req.url || '').split('?')[0]);
      if (pathname === '/fastf1' || pathname.startsWith('/fastf1/')) { res.writeHead(404); res.end(); return; }
      next();
    });
  };
  return {
    name: 'private-analysis-boundary',
    buildStart() {
      if (existsSync(path.resolve('public/fastf1'))) throw new Error('FastF1 exports must stay in data/private-fastf1, outside public');
    },
    configureServer: rejectPublicData,
    configurePreviewServer: rejectPublicData,
  };
}

function createCriticalCssPlugin() {
  return {
    name: 'f1-inline-critical-css',
    apply: 'build' as const,
    transformIndexHtml: {
      order: 'post' as const,
      handler(html: string, context: { bundle?: OutputBundle }) {
        const bundle = context.bundle
        if (!bundle) throw new Error('Cannot inline critical CSS without the production bundle')

        let inlinedStylesheets = 0
        const transformedHtml = html.replace(/<link\b[^>]*rel="stylesheet"[^>]*>/gi, (tag) => {
          const href = tag.match(/href="\/(assets\/[^"?]+\.css)"/i)?.[1]
          if (!href) return tag

          const cssAsset = bundle[href]
          if (!cssAsset || cssAsset.type !== 'asset') {
            throw new Error(`Cannot inline missing critical stylesheet: ${href}`)
          }

          const css = String(cssAsset.source)
          if (/<\/style/i.test(css)) {
            throw new Error(`Critical stylesheet contains an unsafe closing style tag: ${href}`)
          }
          inlinedStylesheets += 1
          return `<style data-critical-css="${path.basename(href)}">${css}</style>`
        })

        if (inlinedStylesheets === 0) {
          throw new Error('No entry stylesheets were found to inline as critical CSS')
        }
        const accountEntries = Object.values(bundle)
          .filter((entry): entry is OutputChunk => entry.type === 'chunk'
            && /\/src\/(?:pages\/Login|components\/auth\/AuthShell)\.tsx$/.test(entry.facadeModuleId?.replace(/\\/g, '/') || ''))
        const accountScripts = new Set(accountEntries.map(entry => entry.fileName))
        const accountStyles = new Set<string>()
        const visited = new Set<string>()
        const collectAccountStyles = (chunk: OutputChunk) => {
          if (visited.has(chunk.fileName)) return
          visited.add(chunk.fileName)
          const metadata = (chunk as OutputChunk & { viteMetadata?: { importedCss: Set<string> } }).viteMetadata
          if (metadata?.importedCss.size) accountScripts.add(chunk.fileName)
          metadata?.importedCss.forEach(file => accountStyles.add(file))
          chunk.imports.forEach(file => {
            const dependency = bundle[file]
            if (dependency?.type === 'chunk') collectAccountStyles(dependency)
          })
        }
        accountEntries.forEach(collectAccountStyles)
        const accountEntryPreloads = [...accountScripts]
          .filter(file => !transformedHtml.includes(`href="/${file}"`))
          .map(file => `<link rel="modulepreload" crossorigin href="/${file}">`).join('\n')
        const stylePreload = [...accountStyles]
          .filter(file => !transformedHtml.includes(`data-critical-css="${path.basename(file)}"`))
          .map(file => `<link rel="preload" as="style" crossorigin href="/${file}">`).join('\n')
        const fontPreloads = ['F1UIAccountTitle-400']
          .map(name => `<link rel="preload" as="font" type="font/woff2" crossorigin href="/fonts/${name}.woff2">`).join('\n')
        return transformedHtml.replace('</head>', `${accountEntryPreloads}\n${stylePreload}\n${fontPreloads}\n</head>`)
      },
    },
  }
}

function createServiceWorkerPlugin() {
  return {
    name: 'f1-service-worker',
    apply: 'build' as const,
    generateBundle(_options: unknown, bundle: OutputBundle) {
      const shellFiles = new Set([
        '/index.html',
        '/manifest.webmanifest',
        '/favicon-192.png',
        '/favicon-512.png',
      ])
      const chunksByFile = new Map(
        Object.values(bundle)
          .filter((entry): entry is OutputChunk => entry.type === 'chunk')
          .map((entry) => [entry.fileName, entry]),
      )

      const addChunk = (fileName: string) => {
        if (shellFiles.has(`/${fileName}`)) return
        const chunk = chunksByFile.get(fileName)
        if (!chunk) return
        shellFiles.add(`/${fileName}`)
        chunk.imports.forEach(addChunk)
      }

      for (const output of Object.values(bundle)) {
        if (output.type === 'chunk' && output.isEntry) addChunk(output.fileName)
        if (output.type === 'asset' && /\.(?:css|woff2)$/.test(output.fileName)) {
          shellFiles.add(`/${output.fileName}`)
        }
      }

      const cacheVersionInput = [...shellFiles].sort().map((fileName) => {
        const bundleEntry = bundle[fileName.slice(1)]
        if (bundleEntry?.type === 'chunk') {
          return `${fileName}:${createHash('sha256').update(bundleEntry.code).digest('hex')}`
        }
        if (bundleEntry?.type === 'asset') {
          return `${fileName}:${createHash('sha256').update(bundleEntry.source).digest('hex')}`
        }

        const sourcePath = fileName === '/index.html'
          ? path.resolve(process.cwd(), 'index.html')
          : path.resolve(process.cwd(), 'public', fileName.slice(1))
        const contents = existsSync(sourcePath) ? readFileSync(sourcePath) : fileName
        return `${fileName}:${createHash('sha256').update(contents).digest('hex')}`
      })
      const cacheVersion = createHash('sha256')
        .update(cacheVersionInput.join('\n'))
        .digest('hex')
        .slice(0, 12)
      const source = `
const SHELL_CACHE = 'f1-shell-${cacheVersion}';
const DATA_CACHE = 'f1-data-v1';
const APP_SHELL = ${JSON.stringify([...shellFiles].sort())};

async function trimCache(cache, maxEntries) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - maxEntries)).map((key) => cache.delete(key)));
}


function requestClientBuildId(client) {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timeout = setTimeout(() => resolve(null), 1000);
    channel.port1.onmessage = (event) => {
      clearTimeout(timeout);
      resolve(typeof event.data?.buildId === 'string' ? event.data.buildId : null);
    };
    client.postMessage({ type: 'GET_CLIENT_BUILD_ID' }, [channel.port2]);
  });
}

async function pruneUnusedShellCaches() {
  const allClients = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });
  const clientBuildIds = await Promise.all(allClients.map(requestClientBuildId));
  if (clientBuildIds.some((buildId) => buildId !== SHELL_CACHE)) return;

  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter((cacheName) => cacheName.startsWith('f1-shell-') && cacheName !== SHELL_CACHE)
      .map((cacheName) => caches.delete(cacheName)),
  );
}

function isExpectedResponse(request, response) {
  if (!response || !response.ok || response.type === 'opaque') return false;
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (request.destination === 'script') return /(?:java|ecma)script/.test(contentType);
  if (request.destination === 'style') return contentType.includes('text/css');
  if (request.destination === 'font') return contentType.includes('font/') || contentType.includes('application/font');
  if (request.destination === 'image') return contentType.startsWith('image/');
  if (request.destination === 'manifest') return contentType.includes('json');
  return true;
}

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.delete(DATA_CACHE));
});

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'GET_BUILD_ID') {
    event.ports[0]?.postMessage({ buildId: SHELL_CACHE });
    return;
  }
  if (event.data?.type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
    return;
  }
  if (event.data?.type === 'PRUNE_UNUSED_SHELL_CACHES') {
    event.waitUntil(pruneUnusedShellCaches());
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.open(SHELL_CACHE).then((cache) => cache.match('/index.html'))),
    );
    return;
  }

  if (url.pathname.startsWith('/f1-api/')) {
    const cachePromise = caches.open(DATA_CACHE).catch(() => null);
    // A cached pre-race empty response must never mask a published classification.
    const network = fetch(request);
    event.waitUntil(network.then(async (response) => {
      if (response.ok && (response.headers.get('content-type') || '').includes('json')) {
        const snapshot = response.clone();
        const cache = await cachePromise;
        if (!cache) return;
        await cache.put(request, snapshot);
        await trimCache(cache, 120);
      }
    }).catch(() => undefined));
    event.respondWith(
      network.then(async (response) => {
        if (response.ok) return response;
        const cached = await cachePromise.then((cache) => cache.match(request)).catch(() => undefined);
        return cached || response;
      }).catch(async (error) => {
        const cached = await cachePromise.then((cache) => cache.match(request)).catch(() => undefined);
        if (cached) return cached;
        throw error;
      }),
    );
    return;
  }

  if (url.pathname.startsWith('/fastf1/')) {
    event.respondWith(Promise.resolve(new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } })));
    return;
  }

  if (APP_SHELL.includes(url.pathname) || url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(SHELL_CACHE).then((cache) => cache.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (!isExpectedResponse(request, response)) {
          return response;
        }
        return cache.put(request, response.clone())
          .then(() => response);
      }))),
    );
  }
});
`

      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

function createReleaseIdentityPlugin(): Plugin {
  return {
    name: 'f1-release-identity',
    apply: 'build',
    generateBundle(_options, bundle) {
      const version = JSON.parse(readFileSync(path.resolve('package.json'), 'utf8')).version
      const buildId = createHash('sha256').update(Object.values(bundle)
        .sort((left, right) => left.fileName.localeCompare(right.fileName))
        .map((entry) => `${entry.fileName}:${createHash('sha256').update(entry.type === 'chunk' ? entry.code : entry.source).digest('hex')}`).join('\n'))
        .update(readFileSync(path.resolve('public/fonts/manifest.json')))
        .update(version).digest('hex').slice(0, 12)
      this.emitFile({ type: 'asset', fileName: 'release.json', source: JSON.stringify({ version, buildId }) })
    },
  }
}

export default defineConfig({
  plugins: [
    raceWeatherApi(),
    react(),
    pitStopsApi(),
    privateDataGuard(),
    newsFeedGuard(),
    createCriticalCssPlugin(),
    createServiceWorkerPlugin(),
    createReleaseIdentityPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    manifest: true,
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/app-[hash].js',
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/')

          // Keep small, shared bootstrap modules on one connection so cold
          // mobile visits do not pay a request round-trip for each helper.
          const bootstrapSources = [
            '/src/main.tsx',
            '/src/i18n.ts',
            '/src/components/auth/AccessGate.tsx',
            '/src/api/fastf1AnalyticsCache.ts',
            '/src/router/routeModules.ts',
            '/src/hooks/useAuthSession.ts',
            '/src/hooks/authContext.ts',
            '/src/utils/accessPolicy.ts',
            '/src/utils/supabaseConfig.ts',
            '/src/utils/logger.ts',
            '/src/utils/raceDisplayName.ts',
            '/src/store/index.ts',
          ]
          if (bootstrapSources.some((source) => normalizedId.endsWith(source))) return 'app-runtime'

          if (/\/node_modules\/(?:react|react-dom|react-router|react-router-dom|scheduler|zustand)\//.test(normalizedId)) {
            return 'app-runtime'
          }

          if (!normalizedId.includes('node_modules')) {
            return undefined
          }

          if (
            normalizedId.includes('/echarts/core')
            || normalizedId.includes('/echarts/charts/')
            || normalizedId.includes('/echarts/components/')
            || normalizedId.includes('/echarts/renderers/')
            || normalizedId.includes('/zrender/')
          ) {
            return 'chart-vendor'
          }

          if (normalizedId.includes('/axios/')) return 'axios-vendor'

          if (normalizedId.includes('/zustand/')) return 'state-vendor'

          return undefined
        },
      },
    },
  },
  server: {
    port: 3000,
    open: false,
    proxy: { ...f1ApiProxy, ...newsFeedProxy },
  },
  preview: {
    proxy: { ...f1ApiProxy, ...newsFeedProxy },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: 'coverage',
      include: [
        'src/api/**/*.ts',
        'src/hooks/**/*.ts',
        'src/pages/Race/shared/**/*.ts',
        'src/utils/**/*.ts',
      ],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/utils/mockData.ts',
        'src/utils/evals/**',
      ],
      thresholds: {
        statements: 44,
        branches: 38,
        functions: 45,
        lines: 44,
      },
    },
  }
})
