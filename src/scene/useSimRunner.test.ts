import { SIM_DT } from './useSimRunner';
import { getSimRunnerHandle } from '../state/simHistory';

describe('useSimRunner — Channel-B history handle', () => {
  it('exposes a read-only handle with history/iteration/runId', () => {
    const h = getSimRunnerHandle();
    expect(Array.isArray(h.history)).toBe(true);
    expect(typeof h.iteration).toBe('number');
    expect(typeof h.runId).toBe('number');
  });

  it('uses a teaching pace of four optimizer steps per second', () => {
    expect(SIM_DT).toBe(0.25);
  });
});
