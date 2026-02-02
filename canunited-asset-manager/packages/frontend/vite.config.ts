import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// GitHub Pages base URL (set via env or defaults to root)
const base = process.env.GITHUB_PAGES === 'true'
  ? '/canunited-asset-manager/'
  : '/';

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@canunited/shared': path.resolve(__dirname, '../shared/src')
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:4000',
        ws: true
      }
    }
  }
});
