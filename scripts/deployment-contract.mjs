export const CONTENT_SECURITY_POLICY =
  "default-src 'self'; base-uri 'none'; connect-src 'self' https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io; font-src 'self'; form-action 'none'; frame-ancestors 'none'; img-src 'self' data: blob:; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:";

export const SECURITY_HEADERS = {
  'content-security-policy': CONTENT_SECURITY_POLICY,
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'permissions-policy':
    'camera=(), geolocation=(), microphone=(), payment=(), usb=()',
  'referrer-policy': 'no-referrer',
  'strict-transport-security': 'max-age=63072000',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
};

export const HTML_CACHE_CONTROL = 'public, max-age=0, must-revalidate';
export const IMMUTABLE_CACHE_CONTROL =
  'public, max-age=31536000, immutable';
export const HDR_PATH =
  '/hdri/satara_night_no_lamps_1k.2184494e.hdr';
