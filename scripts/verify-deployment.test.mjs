import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { createServer } from 'node:http';
import test from 'node:test';
import {
  HDR_PATH,
  HTML_CACHE_CONTROL,
  IMMUTABLE_CACHE_CONTROL,
  SECURITY_HEADERS,
} from './deployment-contract.mjs';
import { verifyDeployment } from './verify-deployment.mjs';

test('verifies the complete production response contract', async (context) => {
  const server = createServer((request, response) => {
    if (request.url === '/assets/index-abc123.js') {
      response.writeHead(200, {
        'cache-control': IMMUTABLE_CACHE_CONTROL,
        'content-encoding': 'gzip',
        'content-type': 'text/javascript',
      });
      response.end(gzipSync('console.log("ok")'));
      return;
    }
    if (request.url === HDR_PATH) {
      response.writeHead(200, {
        'cache-control': IMMUTABLE_CACHE_CONTROL,
        'content-type': 'application/octet-stream',
      });
      response.end();
      return;
    }
    if (request.url === '/__ascent_deployment_probe_missing__') {
      response.writeHead(404, SECURITY_HEADERS);
      response.end();
      return;
    }

    response.writeHead(200, {
      ...SECURITY_HEADERS,
      'cache-control': HTML_CACHE_CONTROL,
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

test('rejects a soft 404 fallback', async (context) => {
  const server = createServer((request, response) => {
    if (request.url === '/assets/index-abc123.js') {
      response.writeHead(200, {
        'cache-control': IMMUTABLE_CACHE_CONTROL,
        'content-encoding': 'gzip',
      });
      response.end(gzipSync('console.log("ok")'));
      return;
    }
    if (request.url === HDR_PATH) {
      response.writeHead(200, { 'cache-control': IMMUTABLE_CACHE_CONTROL });
      response.end();
      return;
    }

    response.writeHead(200, {
      ...SECURITY_HEADERS,
      'cache-control': HTML_CACHE_CONTROL,
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
  await assert.rejects(
    verifyDeployment(`http://127.0.0.1:${address.port}`, 'abc123'),
    /Missing-path status: expected 404, received 200/,
  );
});
