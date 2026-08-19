import { SIM_DT, simulationElapsedForFrame } from './useSimRunner';
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

  it('scales presentation time without changing the fixed optimizer timestep', () => {
    expect(simulationElapsedForFrame(1 / 60, 500)).toBeCloseTo(1 / 120);
    expect(simulationElapsedForFrame(1 / 60, 250)).toBeCloseTo(1 / 60);
    expect(simulationElapsedForFrame(1 / 60, 125)).toBeCloseTo(1 / 30);
    expect(simulationElapsedForFrame(1 / 60, 62.5)).toBeCloseTo(1 / 15);
    expect(simulationElapsedForFrame(10, 62.5)).toBe(SIM_DT);
  });
});
