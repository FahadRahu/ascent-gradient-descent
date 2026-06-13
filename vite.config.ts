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
    // M0 foundation has no engine tests yet (they land in Tasks 4-16). Vitest 4
    // exits 1 on an empty suite by default; opt into a green run so the harness
    // verifies and any CI/downstream gate on `npm test` passes until tests land.
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['src/engine/**', 'src/state/**', 'src/quality/**'],
      reporter: ['text', 'html'],
    },
  },
});
