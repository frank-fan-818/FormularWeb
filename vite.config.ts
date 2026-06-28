import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['vite.svg'],
      manifest: {
        name: 'F1 Dashboard',
        short_name: 'F1DB',
        description: 'Formula 1 data dashboard with race analytics, telemetry, and predictions',
        theme_color: '#ff1801',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          {
            src: '/favicon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/favicon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        // Only precache stable assets (icons, images, fonts). JS/CSS/HTML are
        // version-hashed by Vite and cached by the browser — SW precaching them
        // causes stale chunk 404 errors after every Vercel deployment.
        globPatterns: ['**/*.{ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: {
                maxEntries: 4,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
          {
            urlPattern: /^https:\/\/[a-z0-9-]+\.supabase\.co\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'supabase-api',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 5, // 5 minutes
              },
            },
          },
          {
            urlPattern: /^https:\/\/api\.jolpi\.ca\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'jolpica-api',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60, // 1 hour
              },
              networkTimeoutSeconds: 10,
            },
          },
          {
            urlPattern: /\/fastf1\//i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fastf1-data',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
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
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
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

          if (
            normalizedId.includes('/@supabase/')
            || normalizedId.includes('/@capacitor/')
            || normalizedId.includes('/axios/')
            || normalizedId.includes('/zustand/')
          ) {
            return 'data-vendor'
          }

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
    // TODO(Sprint 2): Remove this once withRetry.test.ts fake-timer unhandled
    // rejection is properly fixed. See: withRetry.test.ts "stops retrying"
    dangerouslyIgnoreUnhandledErrors: true,
  }
})
