import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-192.png', 'favicon-512.png'],
      manifest: {
        name: 'F1 Data Center',
        short_name: 'F1 Data',
        theme_color: '#ff1801',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: '/favicon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/favicon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        globPatterns: [
          '**/*.{css,html,woff2}',
          'assets/app-*.js',
          'assets/Home-*.js',
          'assets/state-vendor-*.js',
        ],
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) => url.origin === self.location.origin
              && ['script', 'style', 'font'].includes(request.destination),
            handler: 'CacheFirst',
            options: {
              cacheName: 'app-assets-v1',
              expiration: { maxEntries: 80, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\/fastf1\/.*\.json$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'fastf1-analysis-v1',
              expiration: { maxEntries: 80, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
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

          if (normalizedId.includes('/@supabase/')) return 'supabase-vendor'
          if (normalizedId.includes('/axios/')) return 'axios-vendor'

          if (normalizedId.includes('/zustand/')) return 'state-vendor'

          return undefined
        },
      },
    },
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/f1-api': {
        target: 'https://api.jolpi.ca',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/f1-api/, '/ergast/f1'),
      }
    }
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
  }
})
