import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
export default defineConfig({
  root: 'mobile',
  base: './',
  envDir: fileURLToPath(new URL('./mobile', import.meta.url)),
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  build: { outDir: '../dist-mobile', emptyOutDir: true, target: 'es2022', sourcemap: false },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['.e2b.app', '.arena.ai'],
    proxy: { '/api': 'http://127.0.0.1:3000', '/images': 'http://127.0.0.1:3000' },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: ['.e2b.app', '.arena.ai'],
    proxy: { '/api': 'http://127.0.0.1:3000', '/images': 'http://127.0.0.1:3000' },
  },
});
