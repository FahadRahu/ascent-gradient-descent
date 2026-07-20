import { gzipSync } from 'node:zlib';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const DIST = path.resolve('dist');
const MANIFEST_PATH = path.join(DIST, '.vite', 'manifest.json');
const BUDGETS = {
  initialJavaScriptGzip: 200_000,
  totalJavaScriptGzip: 700_000,
  largestStaticAsset: 2_000_000,
};

const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
const entry = Object.values(manifest).find((item) => item.isEntry);
if (!entry) throw new Error('Could not find the Vite entry in dist/.vite/manifest.json.');

const initialFiles = new Set();
const visitInitialChunk = (item) => {
  if (!item || initialFiles.has(item.file)) return;
  initialFiles.add(item.file);
  for (const importKey of item.imports ?? []) visitInitialChunk(manifest[importKey]);
};
visitInitialChunk(entry);

const assetFiles = await readdir(path.join(DIST, 'assets'));
const javascriptFiles = assetFiles
  .filter((file) => file.endsWith('.js'))
  .map((file) => `assets/${file}`);

const gzipSize = async (relativePath) => {
  const contents = await readFile(path.join(DIST, relativePath));
  return gzipSync(contents).byteLength;
};

const initialJavaScriptGzip = (
  await Promise.all(
    [...initialFiles]
      .filter((file) => file.endsWith('.js'))
      .map(gzipSize),
  )
).reduce((sum, size) => sum + size, 0);
const totalJavaScriptGzip = (
  await Promise.all(javascriptFiles.map(gzipSize))
).reduce((sum, size) => sum + size, 0);

async function listFiles(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const item of entries) {
    const relativePath = path.join(prefix, item.name);
    if (item.isDirectory()) {
      files.push(...await listFiles(path.join(directory, item.name), relativePath));
    } else {
      files.push(relativePath);
    }
  }
  return files;
}

const allFiles = await listFiles(DIST);
const sizedFiles = await Promise.all(
  allFiles.map(async (file) => ({
    file,
    size: (await stat(path.join(DIST, file))).size,
  })),
);
const largest = sizedFiles.sort((a, b) => b.size - a.size)[0];

const measurements = {
  initialJavaScriptGzip,
  totalJavaScriptGzip,
  largestStaticAsset: largest.size,
};
console.log('Bundle budgets:', measurements, 'largest:', largest.file);

const failures = Object.entries(BUDGETS)
  .filter(([name, budget]) => measurements[name] > budget)
  .map(([name, budget]) => `${name}: ${measurements[name]} > ${budget}`);

if (failures.length > 0) {
  throw new Error(`Bundle budget exceeded:\n${failures.join('\n')}`);
}
