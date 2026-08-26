import { defineConfig } from 'vite'
import type { OutputBundle, OutputChunk } from 'rollup'
import react from '@vitejs/plugin-react'
import path from 'path'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'

const f1ApiProxy = {
  '/f1-api': {
    target: 'https://api.jolpi.ca',
    changeOrigin: true,
    secure: true,
    rewrite: (requestPath: string) => requestPath.replace(/^\/f1-api/, '/ergast/f1'),
  },
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
        return transformedHtml
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
    const cachePromise = caches.open(DATA_CACHE);
    const network = cachePromise.then(async (cache) => {
      const response = await fetch(request);
      if (response.ok && (response.headers.get('content-type') || '').includes('json')) {
        await cache.put(request, response.clone());
        await trimCache(cache, 120);
      }
      return response;
    });
    event.waitUntil(network.then(() => undefined, () => undefined));
    event.respondWith(
      cachePromise.then(async (cache) => {
        const cached = await cache.match(request);
        return cached || network;
      }),
    );
    return;
  }

  if (/\\/fastf1\\/.*\\.json$/.test(url.pathname)) {
    const cachePromise = caches.open(DATA_CACHE);
    const network = cachePromise.then(async (cache) => {
      const response = await fetch(request);
      if (response.ok && (response.headers.get('content-type') || '').includes('json')) {
        await cache.put(request, response.clone());
        await trimCache(cache, 80);
      }
      return response;
    });
    event.waitUntil(network.then(() => undefined, () => undefined));
    event.respondWith(
      cachePromise.then(async (cache) => {
        const cached = await cache.match(request);
        return cached || network;
      }),
    );
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

export default defineConfig({
  plugins: [
    react(),
    createCriticalCssPlugin(),
    createServiceWorkerPlugin(),
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
    proxy: f1ApiProxy,
  },
  preview: {
    proxy: f1ApiProxy,
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
