/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import path from 'path';

const releaseRevision =
  process.env.VITE_RELEASE_SHA ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  'development';
const deployEnvironment =
  process.env.VITE_DEPLOY_ENV ?? process.env.VERCEL_ENV ?? 'local';
const sentrySourceMapUploadEnabled =
  releaseRevision !== 'development' &&
  Boolean(
    process.env.SENTRY_AUTH_TOKEN &&
      process.env.SENTRY_ORG &&
      process.env.SENTRY_PROJECT,
  );
const sentryBuildPlugin = sentrySourceMapUploadEnabled
  ? sentryVitePlugin({
      authToken: process.env.SENTRY_AUTH_TOKEN,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      telemetry: false,
      sourcemaps: {
        assets: './dist/assets/**',
        filesToDeleteAfterUpload: './dist/**/*.map',
      },
      release: {
        name: releaseRevision,
        setCommits: false,
      },
      bundleSizeOptimizations: {
        excludeDebugStatements: true,
        excludeTracing: true,
      },
    })
  : undefined;

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
    ...(sentryBuildPlugin ? [sentryBuildPlugin] : []),
  ],
  define: {
    'import.meta.env.VITE_RELEASE_SHA': JSON.stringify(releaseRevision),
    'import.meta.env.VITE_DEPLOY_ENV': JSON.stringify(deployEnvironment),
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
    sourcemap: sentrySourceMapUploadEnabled ? 'hidden' : false,
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
