import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  HDR_PATH,
  HTML_CACHE_CONTROL,
  IMMUTABLE_CACHE_CONTROL,
  SECURITY_HEADERS,
} from './deployment-contract.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(ROOT, relativePath), 'utf8'));
}

function headerMap(rule) {
  return Object.fromEntries(
    rule.headers.map(({ key, value }) => [key.toLowerCase(), value]),
  );
}

test('pins the Vercel build contract', async () => {
  const [packageJson, vercel] = await Promise.all([
    readJson('package.json'),
    readJson('vercel.json'),
  ]);

  assert.equal(packageJson.engines.node, '22.x');
  assert.match(packageJson.packageManager, /^npm@\d+\.\d+\.\d+$/);
  assert.equal(vercel.framework, 'vite');
  assert.equal(vercel.installCommand, 'npm ci');
  assert.equal(vercel.buildCommand, 'npm run build');
  assert.equal(vercel.outputDirectory, 'dist');
  assert.equal(vercel.rewrites, undefined);
  assert.equal(vercel.redirects, undefined);
  assert.match(packageJson.dependencies['@sentry/react'], /^\^10\./);
  assert.match(packageJson.devDependencies['@sentry/vite-plugin'], /^\^5\./);
});

test('defines the complete security and cache policy', async () => {
  const vercel = await readJson('vercel.json');
  const rules = new Map(vercel.headers.map((rule) => [rule.source, rule]));

  assert.deepEqual(headerMap(rules.get('/(.*)')), SECURITY_HEADERS);
  assert.equal(
    headerMap(rules.get('/'))['cache-control'],
    HTML_CACHE_CONTROL,
  );
  assert.equal(
    headerMap(rules.get('/assets/(.*)'))['cache-control'],
    IMMUTABLE_CACHE_CONTROL,
  );
  assert.equal(
    headerMap(rules.get('/hdri/(.*)'))['cache-control'],
    IMMUTABLE_CACHE_CONTROL,
  );
});

test('uses a content fingerprint in the immutable HDR URL', async () => {
  const filename = path.basename(HDR_PATH);
  const fingerprint = filename.match(/\.([0-9a-f]{8})\.hdr$/)?.[1];
  assert.ok(fingerprint, `Missing HDR fingerprint in ${filename}`);

  const contents = await readFile(path.join(ROOT, 'public', ...HDR_PATH.split('/')));
  const digest = createHash('sha256').update(contents).digest('hex');
  assert.equal(fingerprint, digest.slice(0, 8));
});

test('keeps Sentry source-map credentials out of browser configuration', async () => {
  const [viteConfig, envExample] = await Promise.all([
    readFile(path.join(ROOT, 'vite.config.ts'), 'utf8'),
    readFile(path.join(ROOT, '.env.example'), 'utf8'),
  ]);

  assert.match(viteConfig, /process\.env\.SENTRY_AUTH_TOKEN/);
  assert.doesNotMatch(viteConfig, /import\.meta\.env\.SENTRY_AUTH_TOKEN/);
  assert.doesNotMatch(viteConfig, /VITE_SENTRY_AUTH_TOKEN/);
  assert.match(viteConfig, /filesToDeleteAfterUpload: '\.\/dist\/\*\*\/\*\.map'/);
  assert.match(envExample, /^SENTRY_AUTH_TOKEN=$/m);
  assert.doesNotMatch(envExample, /^SENTRY_AUTH_TOKEN=.+$/m);
});
