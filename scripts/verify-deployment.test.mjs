import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { createServer } from 'node:http';
import test from 'node:test';
import { verifyDeployment } from './verify-deployment.mjs';

const SECURITY_HEADERS = {
  'cache-control': 'public, max-age=0, must-revalidate',
  'content-security-policy':
    "default-src 'self'; frame-ancestors 'none'; object-src 'none'",
  'permissions-policy': 'camera=(), microphone=()',
  'referrer-policy': 'no-referrer',
  'strict-transport-security': 'max-age=63072000; includeSubDomains; preload',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
};

test('verifies the complete production response contract', async (context) => {
  const server = createServer((request, response) => {
    if (request.url === '/assets/index-abc123.js') {
      response.writeHead(200, {
        'cache-control': 'public, max-age=31536000, immutable',
        'content-encoding': 'gzip',
        'content-type': 'text/javascript',
      });
      response.end(gzipSync('console.log("ok")'));
      return;
    }
    if (request.url === '/.netlify/functions/client-errors') {
      response.writeHead(405, { 'cache-control': 'no-store' });
      response.end();
      return;
    }

    response.writeHead(200, {
      ...SECURITY_HEADERS,
      'content-type': 'text/html',
    });
    response.end(
      '<meta name="release-revision" content="abc123">' +
        '<script type="module" src="/assets/index-abc123.js"></script>',
    );
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  context.after(() => server.close());

  const address = server.address();
  assert(address && typeof address !== 'string');
  const result = await verifyDeployment(
    `http://127.0.0.1:${address.port}`,
    'abc123',
  );

  assert.equal(result.status, 'verified');
  assert.equal(result.revision, 'abc123');
});
