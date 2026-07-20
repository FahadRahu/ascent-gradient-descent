const MAX_BODY_BYTES = 16_384;
const ALLOWED_KINDS = new Set(['error', 'unhandledrejection']);

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
      'x-content-type-options': 'nosniff',
    },
    body: JSON.stringify(body),
  };
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return response(405, { error: 'method_not_allowed' });
  }
  if (event.headers?.['sec-fetch-site'] === 'cross-site') {
    return response(403, { error: 'cross_site_request' });
  }
  if (!event.body || Buffer.byteLength(event.body, 'utf8') > MAX_BODY_BYTES) {
    return response(413, { error: 'invalid_body' });
  }

  let report;
  try {
    report = JSON.parse(event.body);
  } catch {
    return response(400, { error: 'invalid_json' });
  }

  if (
    !ALLOWED_KINDS.has(report.kind) ||
    typeof report.message !== 'string' ||
    typeof report.release !== 'string'
  ) {
    return response(400, { error: 'invalid_report' });
  }

  console.error(JSON.stringify({
    event: 'client_error',
    kind: report.kind,
    message: report.message.slice(0, 1_000),
    stack: typeof report.stack === 'string' ? report.stack.slice(0, 4_000) : undefined,
    path: typeof report.path === 'string' ? report.path.slice(0, 500) : '/',
    release: report.release.slice(0, 100),
    userAgent: typeof report.userAgent === 'string'
      ? report.userAgent.slice(0, 500)
      : undefined,
    occurredAt: report.occurredAt,
  }));

  return response(202, { accepted: true });
}
