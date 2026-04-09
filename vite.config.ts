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
  }
})
