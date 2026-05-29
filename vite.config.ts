import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    chunkSizeWarningLimit: 900,
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
