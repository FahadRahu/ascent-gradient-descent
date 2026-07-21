// @vitest-environment happy-dom
import type { ErrorEvent as SentryErrorEvent } from '@sentry/react';
import { installErrorMonitoring, sanitizeSentryEvent } from './monitoring';

const sentryMocks = vi.hoisted(() => ({
  init: vi.fn(),
  reactErrorHandler: vi.fn(() => vi.fn()),
}));

vi.mock('@sentry/react', () => sentryMocks);

describe('Sentry error monitoring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not initialize outside an enabled deployment with a DSN', () => {
    expect(
      installErrorMonitoring({
        enabled: false,
        dsn: 'https://public@example.ingest.sentry.io/1',
        release: 'abc123',
        environment: 'development',
      }),
    ).toBeUndefined();
    expect(
      installErrorMonitoring({
        enabled: true,
        dsn: ' ',
        release: 'abc123',
        environment: 'production',
      }),
    ).toBeUndefined();
    expect(sentryMocks.init).not.toHaveBeenCalled();
  });

  it('initializes once with privacy-first options and React root handlers', () => {
    const rootOptions = installErrorMonitoring({
      enabled: true,
      dsn: ' https://public@example.ingest.sentry.io/1 ',
      release: 'abc123',
      environment: 'preview',
    });

    expect(sentryMocks.init).toHaveBeenCalledOnce();
    const options = sentryMocks.init.mock.calls[0][0];
    expect(options).toEqual(
      expect.objectContaining({
        dsn: 'https://public@example.ingest.sentry.io/1',
        release: 'abc123',
        environment: 'preview',
        sendDefaultPii: false,
        maxBreadcrumbs: 0,
        enableLogs: false,
        enableMetrics: false,
        beforeSend: sanitizeSentryEvent,
      }),
    );
    expect(
      options.integrations?.([
        { name: 'Breadcrumbs' },
        { name: 'BrowserSession' },
        { name: 'GlobalHandlers' },
      ]),
    ).toEqual([{ name: 'GlobalHandlers' }]);
    expect(sentryMocks.reactErrorHandler).toHaveBeenCalledOnce();
    expect(rootOptions?.onCaughtError).toBe(rootOptions?.onRecoverableError);
    expect(rootOptions?.onCaughtError).toBe(rootOptions?.onUncaughtError);
  });

  it('removes sensitive context and bounds error data before sending', () => {
    const event: SentryErrorEvent = {
      type: undefined,
      message: 'm'.repeat(1_500),
      request: {
        url: 'https://ascent.vercel.app/lesson?token=secret#answer',
        headers: { authorization: 'Bearer secret' },
        cookies: { session: 'secret' },
        data: { secret: 'body' },
      },
      user: { email: 'learner@example.com' },
      extra: { secret: 'value' },
      breadcrumbs: [{ message: 'sensitive interaction' }],
      exception: {
        values: [
          {
            type: 'Error',
            value: 'x'.repeat(1_500),
            stacktrace: {
              frames: [
                {
                  filename:
                    'https://ascent.vercel.app/assets/index.js?token=secret#frame',
                  vars: { secret: 'value' },
                },
              ],
            },
          },
        ],
      },
    };

    const sanitized = sanitizeSentryEvent(event);

    expect(sanitized.message).toHaveLength(1_000);
    expect(sanitized.request).toEqual({ url: '/lesson' });
    expect(sanitized.user).toBeUndefined();
    expect(sanitized.extra).toBeUndefined();
    expect(sanitized.breadcrumbs).toBeUndefined();
    expect(sanitized.exception?.values?.[0]?.value).toHaveLength(1_000);
    expect(
      sanitized.exception?.values?.[0]?.stacktrace?.frames?.[0]?.filename,
    ).toBe('https://ascent.vercel.app/assets/index.js');
    expect(
      sanitized.exception?.values?.[0]?.stacktrace?.frames?.[0]?.vars,
    ).toBeUndefined();
  });
});
