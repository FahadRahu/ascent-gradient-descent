import { pathToFileURL } from 'node:url';

function expectHeader(failures, headers, name, pattern) {
  const value = headers.get(name) ?? '';
  if (!pattern.test(value)) {
    failures.push(`${name}: expected ${pattern}, received ${JSON.stringify(value)}`);
  }
}

export async function verifyDeployment(target, expectedRevision) {
  if (!target) {
    throw new Error('Provide a production URL or set PRODUCTION_URL.');
  }

  const url = new URL(target);
  if (
    url.protocol !== 'https:' &&
    url.hostname !== '127.0.0.1' &&
    url.hostname !== 'localhost'
  ) {
    throw new Error('Production verification requires HTTPS.');
  }

  const failures = [];
  const htmlResponse = await fetch(url, {
    headers: { 'accept-encoding': 'br, gzip' },
    redirect: 'follow',
  });
  if (!htmlResponse.ok) failures.push(`HTML status: ${htmlResponse.status}`);
  expectHeader(
    failures,
    htmlResponse.headers,
    'cache-control',
    /(max-age=0|no-cache).*(must-revalidate)?/i,
  );
  expectHeader(
    failures,
    htmlResponse.headers,
    'content-security-policy',
    /frame-ancestors 'none'/i,
  );
  expectHeader(
    failures,
    htmlResponse.headers,
    'content-security-policy',
    /default-src 'self'/i,
  );
  expectHeader(
    failures,
    htmlResponse.headers,
    'strict-transport-security',
    /max-age=63072000/i,
  );
  expectHeader(
    failures,
    htmlResponse.headers,
    'x-content-type-options',
    /^nosniff$/i,
  );
  expectHeader(failures, htmlResponse.headers, 'x-frame-options', /^DENY$/i);
  expectHeader(
    failures,
    htmlResponse.headers,
    'referrer-policy',
    /^no-referrer$/i,
  );
  expectHeader(
    failures,
    htmlResponse.headers,
    'permissions-policy',
    /camera=\(\)/i,
  );

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
    const assetResponse = await fetch(new URL(assetPath, url), {
      headers: { 'accept-encoding': 'br, gzip' },
    });
    if (!assetResponse.ok) failures.push(`Asset status: ${assetResponse.status}`);
    expectHeader(
      failures,
      assetResponse.headers,
      'cache-control',
      /max-age=31536000.*immutable/i,
    );
    expectHeader(
      failures,
      assetResponse.headers,
      'content-encoding',
      /^(br|gzip)$/i,
    );
    await assetResponse.arrayBuffer();
  }

  const monitoringResponse = await fetch(
    new URL('/.netlify/functions/client-errors', url),
  );
  if (monitoringResponse.status !== 405) {
    failures.push(
      `Client-error endpoint probe: expected 405, received ${monitoringResponse.status}`,
    );
  }

  if (failures.length > 0) {
    throw new Error(`Production verification failed:\n- ${failures.join('\n- ')}`);
  }

  return {
    url: url.href,
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
