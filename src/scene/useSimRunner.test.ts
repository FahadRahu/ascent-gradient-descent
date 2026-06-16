import { getSimRunnerHandle } from './useSimRunner';

describe('useSimRunner — Channel-B history handle', () => {
  it('exposes a read-only handle with history/iteration/runId', () => {
    const h = getSimRunnerHandle();
    expect(Array.isArray(h.history)).toBe(true);
    expect(typeof h.iteration).toBe('number');
    expect(typeof h.runId).toBe('number');
  });
});
