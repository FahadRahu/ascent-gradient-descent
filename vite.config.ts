/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const releaseRevision =
  process.env.VITE_RELEASE_SHA ?? process.env.COMMIT_REF ?? 'development';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'release-revision',
      transformIndexHtml: {
        order: 'pre',
        handler: () => [
          {
            tag: 'meta',
            attrs: {
              name: 'release-revision',
              content: releaseRevision,
            },
            injectTo: 'head',
          },
        ],
      },
    },
  ],
  define: {
    'import.meta.env.VITE_RELEASE_SHA': JSON.stringify(releaseRevision),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    manifest: true,
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // M0 foundation has no engine tests yet (they land in Tasks 4-16). Vitest 4
    // exits 1 on an empty suite by default; opt into a green run so the harness
    // verifies and any CI/downstream gate on `npm test` passes until tests land.
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/main.tsx', 'src/vite-env.d.ts'],
      reporter: ['text', 'html', 'json-summary'],
      thresholds: {
        statements: 60,
        branches: 40,
        functions: 65,
        lines: 60,
      },
    },
  },
});
