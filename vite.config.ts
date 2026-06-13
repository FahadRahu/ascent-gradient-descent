/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
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
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // No engine tests exist yet at this commit (Tasks 4+ add them); the harness
    // must still exit 0 so the M0 `npm test` gate passes during bootstrap.
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['src/engine/**', 'src/state/**', 'src/quality/**'],
      reporter: ['text', 'html'],
    },
  },
});
