const ERROR_ENDPOINT = '/.netlify/functions/client-errors';
const MAX_MESSAGE_LENGTH = 1_000;
const MAX_STACK_LENGTH = 4_000;

export interface ClientErrorReport {
  kind: 'error' | 'unhandledrejection';
  message: string;
  stack?: string;
  path: string;
  release: string;
  userAgent: string;
  occurredAt: string;
}

function truncate(value: string, maximum: number): string {
  return value.length > maximum ? value.slice(0, maximum) : value;
}

export function createClientErrorReport(
  kind: ClientErrorReport['kind'],
  error: unknown,
  release: string,
): ClientErrorReport {
  const normalized = error instanceof Error ? error : new Error(String(error));
  return {
    kind,
    message: truncate(normalized.message || normalized.name, MAX_MESSAGE_LENGTH),
    stack: normalized.stack
      ? truncate(normalized.stack, MAX_STACK_LENGTH)
      : undefined,
    path: window.location.pathname,
    release,
    userAgent: truncate(window.navigator.userAgent, 500),
    occurredAt: new Date().toISOString(),
  };
}

function transmit(report: ClientErrorReport): void {
  const body = JSON.stringify(report);
  if (navigator.sendBeacon?.(
    ERROR_ENDPOINT,
    new Blob([body], { type: 'application/json' }),
  )) {
    return;
  }

  void fetch(ERROR_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

export function installErrorMonitoring(release: string): () => void {
  if (!import.meta.env.PROD) return () => undefined;

  const onError = (event: ErrorEvent) => {
    transmit(createClientErrorReport('error', event.error ?? event.message, release));
  };
  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    transmit(createClientErrorReport('unhandledrejection', event.reason, release));
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onUnhandledRejection);

  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onUnhandledRejection);
  };
}
