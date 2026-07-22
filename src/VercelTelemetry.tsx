import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';

const URL_BASE = 'https://ascent.invalid';
const URL_SCHEME = /^[a-z][a-z\d+.-]*:/i;

interface TelemetryEvent {
  url: string;
}

export function sanitizeTelemetryEvent<T extends TelemetryEvent>(event: T): T {
  try {
    const absolute = URL_SCHEME.test(event.url);
    const url = new URL(event.url, URL_BASE);
    url.search = '';
    url.hash = '';
    return {
      ...event,
      url: absolute ? url.href : url.pathname,
    };
  } catch {
    return {
      ...event,
      url: event.url.split(/[?#]/, 1)[0],
    };
  }
}

export function VercelTelemetry() {
  return (
    <>
      <Analytics beforeSend={sanitizeTelemetryEvent} />
      <SpeedInsights beforeSend={sanitizeTelemetryEvent} />
    </>
  );
}
