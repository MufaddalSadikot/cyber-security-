import { defineConfig } from 'vite';
import path from 'node:path';
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';

/**
 * Builds the three extension entry points into `dist/` as IIFE bundles and
 * copies the static manifest/popup/icon. MV3-friendly (no code splitting).
 */
export default defineConfig({
  resolve: {
    alias: {
      '@pvcc/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@pvcc/privacy-engine': path.resolve(__dirname, '../../packages/privacy-engine/src/index.ts'),
      '@pvcc/context-compiler': path.resolve(__dirname, '../../packages/context-compiler/src/index.ts'),
      '@pvcc/action-policy': path.resolve(__dirname, '../../packages/action-policy/src/index.ts'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      input: {
        'service-worker': path.resolve(__dirname, 'src/service-worker.ts'),
        'content-script': path.resolve(__dirname, 'src/content-script.ts'),
        popup: path.resolve(__dirname, 'src/popup.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        format: 'es',
        inlineDynamicImports: false,
      },
    },
  },
  plugins: [
    {
      name: 'copy-static',
      closeBundle() {
        const dist = path.resolve(__dirname, 'dist');
        if (!existsSync(dist)) mkdirSync(dist, { recursive: true });
        for (const f of ['manifest.json', 'popup.html', 'icon128.png']) {
          const src = path.resolve(__dirname, f);
          if (existsSync(src)) copyFileSync(src, path.resolve(dist, f));
        }
      },
    },
  ],
});
