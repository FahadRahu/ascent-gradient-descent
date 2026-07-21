import { pathToFileURL } from 'node:url';
import {
  CONTENT_SECURITY_POLICY,
  HDR_PATH,
  HTML_CACHE_CONTROL,
  IMMUTABLE_CACHE_CONTROL,
  SECURITY_HEADERS,
} from './deployment-contract.mjs';

function expectHeader(failures, headers, name, pattern) {
  const value = headers.get(name) ?? '';
  if (!pattern.test(value)) {
    failures.push(`${name}: expected ${pattern}, received ${JSON.stringify(value)}`);
  }
}

function expectHeaderValue(failures, headers, name, expected) {
  const value = headers.get(name) ?? '';
  if (value.toLowerCase() !== expected.toLowerCase()) {
    failures.push(
      `${name}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(value)}`,
    );
  }
}

export async function verifyDeployment(target, expectedRevision) {
  if (!target) {
    throw new Error('Provide a production URL or set PRODUCTION_URL.');
  }

  const url = new URL(target);
  const isLocal =
    url.hostname === '127.0.0.1' || url.hostname === 'localhost';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocal)) {
    throw new Error('Production verification requires HTTPS.');
  }
  const rootUrl = new URL('/', url);

  const failures = [];
  const htmlResponse = await fetch(rootUrl, {
    headers: { 'accept-encoding': 'br, gzip' },
    redirect: 'follow',
  });
  if (!htmlResponse.ok) failures.push(`HTML status: ${htmlResponse.status}`);
  expectHeaderValue(
    failures,
    htmlResponse.headers,
    'cache-control',
    HTML_CACHE_CONTROL,
  );
  expectHeader(
    failures,
    htmlResponse.headers,
    'content-type',
    /text\/html/i,
  );
  for (const directive of CONTENT_SECURITY_POLICY.split('; ')) {
    expectHeader(
      failures,
      htmlResponse.headers,
      'content-security-policy',
      new RegExp(
        `(?:^|;\\s*)${directive.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:;|$)`,
        'i',
      ),
    );
  }
  for (const [name, expected] of Object.entries(SECURITY_HEADERS)) {
    if (name === 'content-security-policy') continue;
    if (name === 'strict-transport-security') {
      expectHeader(failures, htmlResponse.headers, name, /max-age=63072000/i);
    } else {
      expectHeaderValue(failures, htmlResponse.headers, name, expected);
    }
  }

  const html = await htmlResponse.text();
  const revision = html.match(
    /<meta\s+name=["']release-revision["']\s+content=["']([^"']+)["']/i,
  )?.[1];
  if (!revision || revision === 'development') {
    failures.push(
      `release revision: expected a deployed commit, received ${revision ?? 'missing'}`,
    );
  }
  if (expectedRevision && revision !== expectedRevision) {
    failures.push(
      `release revision: expected ${expectedRevision}, received ${revision}`,
    );
  }

  const assetPath = html.match(
    /(?:src|href)=["'](\/assets\/[^"']+\.(?:js|css))["']/i,
  )?.[1];
  if (!assetPath) {
    failures.push('Could not find a hashed JS/CSS asset in production HTML.');
  } else {
    const assetResponse = await fetch(new URL(assetPath, rootUrl), {
      headers: { 'accept-encoding': 'br, gzip' },
    });
    if (!assetResponse.ok) failures.push(`Asset status: ${assetResponse.status}`);
    expectHeaderValue(
      failures,
      assetResponse.headers,
      'cache-control',
      IMMUTABLE_CACHE_CONTROL,
    );
    expectHeader(
      failures,
      assetResponse.headers,
      'content-encoding',
      /^(br|gzip)$/i,
    );
    await assetResponse.arrayBuffer();
  }

  const hdrResponse = await fetch(new URL(HDR_PATH, rootUrl), {
    method: 'HEAD',
  });
  if (!hdrResponse.ok) failures.push(`HDR status: ${hdrResponse.status}`);
  expectHeaderValue(
    failures,
    hdrResponse.headers,
    'cache-control',
    IMMUTABLE_CACHE_CONTROL,
  );

  const missingResponse = await fetch(
    new URL('/__ascent_deployment_probe_missing__', rootUrl),
    { method: 'HEAD', redirect: 'manual' },
  );
  if (missingResponse.status !== 404) {
    failures.push(
      `Missing-path status: expected 404, received ${missingResponse.status}`,
    );
  }

  if (failures.length > 0) {
    throw new Error(`Production verification failed:\n- ${failures.join('\n- ')}`);
  }

  return {
    url: rootUrl.href,
    revision,
    status: 'verified',
  };
}

const invokedPath = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : undefined;
if (invokedPath === import.meta.url) {
  const result = await verifyDeployment(
    process.argv[2] ?? process.env.PRODUCTION_URL,
    process.env.EXPECTED_RELEASE_SHA,
  );
  console.log(JSON.stringify(result));
}
