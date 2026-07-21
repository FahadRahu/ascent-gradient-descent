import * as Sentry from '@sentry/react';
import type { ErrorEvent as SentryErrorEvent } from '@sentry/react';
import type { RootOptions } from 'react-dom/client';

const MAX_MESSAGE_LENGTH = 1_000;
const MAX_EXCEPTION_VALUES = 10;
const MAX_STACK_FRAMES = 50;
const URL_SCHEME = /^[a-z][a-z\d+.-]*:/i;
const URL_BASE = 'https://ascent.invalid';
const DISABLED_INTEGRATIONS = new Set(['Breadcrumbs', 'BrowserSession']);

export interface ErrorMonitoringOptions {
  enabled: boolean;
  dsn?: string;
  release: string;
  environment: string;
}

function truncate(value: string | undefined, maximum: number) {
  if (!value) return value;
  return value.length > maximum ? value.slice(0, maximum) : value;
}

function stripQueryAndHash(value: string): string {
  try {
    const absolute = URL_SCHEME.test(value);
    const url = new URL(value, URL_BASE);
    url.search = '';
    url.hash = '';
    return absolute ? url.href : url.pathname;
  } catch {
    return value.split(/[?#]/, 1)[0];
  }
}

function pathnameOnly(value: string): string {
  try {
    return new URL(value, URL_BASE).pathname;
  } catch {
    return value.split(/[?#]/, 1)[0];
  }
}

export function sanitizeSentryEvent(
  event: SentryErrorEvent,
): SentryErrorEvent {
  const exception = event.exception
    ? {
        ...event.exception,
        values: event.exception.values?.slice(-MAX_EXCEPTION_VALUES).map((value) => ({
          ...value,
          value: truncate(value.value, MAX_MESSAGE_LENGTH),
          stacktrace: value.stacktrace
            ? {
                ...value.stacktrace,
                frames: value.stacktrace.frames
                  ?.slice(-MAX_STACK_FRAMES)
                  .map((frame) => {
                    const sanitized = { ...frame };
                    delete sanitized.vars;
                    if (sanitized.filename) {
                      sanitized.filename = stripQueryAndHash(sanitized.filename);
                    }
                    return sanitized;
                  }),
              }
            : undefined,
        })),
      }
    : undefined;

  return {
    ...event,
    message: truncate(event.message, MAX_MESSAGE_LENGTH),
    exception,
    request: event.request?.url
      ? { url: pathnameOnly(event.request.url) }
      : undefined,
    breadcrumbs: undefined,
    extra: undefined,
    user: undefined,
  };
}

export function installErrorMonitoring({
  enabled,
  dsn,
  release,
  environment,
}: ErrorMonitoringOptions): RootOptions | undefined {
  const normalizedDsn = dsn?.trim();
  if (!enabled || !normalizedDsn) return undefined;

  Sentry.init({
    dsn: normalizedDsn,
    release,
    environment,
    sendDefaultPii: false,
    maxBreadcrumbs: 0,
    maxValueLength: MAX_MESSAGE_LENGTH,
    enableLogs: false,
    enableMetrics: false,
    integrations: (defaults) =>
      defaults.filter(
        (integration) => !DISABLED_INTEGRATIONS.has(integration.name),
      ),
    beforeSend: sanitizeSentryEvent,
  });

  const reactErrorHandler = Sentry.reactErrorHandler();
  return {
    onCaughtError: reactErrorHandler,
    onRecoverableError: reactErrorHandler,
    onUncaughtError: reactErrorHandler,
  };
}
