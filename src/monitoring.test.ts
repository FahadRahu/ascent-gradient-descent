// @vitest-environment happy-dom
import { createClientErrorReport } from './monitoring';

describe('client error reports', () => {
  it('keeps reports bounded and excludes URL query data', () => {
    window.history.replaceState({}, '', '/lesson?token=secret');
    const error = new Error('x'.repeat(1_500));
    error.stack = 's'.repeat(5_000);

    const report = createClientErrorReport('error', error, 'abc123');

    expect(report.message).toHaveLength(1_000);
    expect(report.stack).toHaveLength(4_000);
    expect(report.path).toBe('/lesson');
    expect(report.release).toBe('abc123');
  });
});
