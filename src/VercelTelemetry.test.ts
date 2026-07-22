import { describe, expect, it } from 'vitest';
import { sanitizeTelemetryEvent } from './VercelTelemetry';

describe('Vercel telemetry privacy filtering', () => {
  it('removes query strings and fragments from absolute URLs', () => {
    expect(
      sanitizeTelemetryEvent({
        type: 'pageview',
        url: 'https://ascent-gradient-descent.vercel.app/privacy?source=email#rights',
      }),
    ).toEqual({
      type: 'pageview',
      url: 'https://ascent-gradient-descent.vercel.app/privacy',
    });
  });

  it('preserves a relative path without its query string or fragment', () => {
    expect(
      sanitizeTelemetryEvent({
        type: 'vital',
        url: '/?experiment=private#scene',
      }),
    ).toEqual({
      type: 'vital',
      url: '/',
    });
  });
});
