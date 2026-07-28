import { defineConfig } from 'vite'
import type { OutputBundle, OutputChunk } from 'rollup'
import react from '@vitejs/plugin-react'
import path from 'path'
import { createHash } from 'node:crypto'

const f1ApiProxy = {
  '/f1-api': {
    target: 'https://api.jolpi.ca',
    changeOrigin: true,
    secure: true,
    rewrite: (requestPath: string) => requestPath.replace(/^\/f1-api/, '/ergast/f1'),
  },
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

      const cacheVersion = createHash('sha256')
        .update([...shellFiles].sort().join('\n'))
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

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key.startsWith('f1-shell-') && key !== SHELL_CACHE)
        .map((key) => caches.delete(key)),
    )),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html')),
    );
    return;
  }

  if (/\\/fastf1\\/.*\\.json$/.test(url.pathname)) {
    event.respondWith(
      caches.open(DATA_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request).then((response) => {
          if (response.ok) {
            void cache.put(request, response.clone()).then(() => trimCache(cache, 80));
          }
          return response;
        }).catch(() => cached);
        return cached || network;
      }),
    );
    return;
  }

  if (APP_SHELL.includes(url.pathname)
      || ['script', 'style', 'font', 'image'].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) {
          void caches.open(SHELL_CACHE).then((cache) => cache.put(request, response.clone()));
        }
        return response;
      })),
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
