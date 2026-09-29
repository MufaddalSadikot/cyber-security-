import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@pvcc/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@pvcc/privacy-engine': path.resolve(__dirname, '../../packages/privacy-engine/src/index.ts'),
      '@pvcc/context-compiler': path.resolve(__dirname, '../../packages/context-compiler/src/index.ts'),
      '@pvcc/action-policy': path.resolve(__dirname, '../../packages/action-policy/src/index.ts'),
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Allow the e2b preview host to reach the dev server.
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
});
