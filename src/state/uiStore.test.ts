import { useUIStore } from './uiStore';
import { simStore } from './simStore';

describe('UI store (Channel A — slow/reactive)', () => {
  beforeEach(() => {
    useUIStore.getState().reset();
  });

  it('has sensible defaults', () => {
    const s = useUIStore.getState();
    expect(s.functionId).toBe('sphere');
    expect(s.optimizerId).toBe('sgd');
    expect(s.learningRate).toBe(0.1);
    expect(s.startPoint).toEqual([3.5, -2.5]);
    expect(s.isPlaying).toBe(false);
    expect(s.tier).toBe('high');
  });

  it('updates function and optimizer selection', () => {
    useUIStore.getState().setFunctionId('ackley');
    useUIStore.getState().setOptimizerId('adam');
    expect(useUIStore.getState().functionId).toBe('ackley');
    expect(useUIStore.getState().optimizerId).toBe('adam');
  });

  it('toggles play state', () => {
    useUIStore.getState().setPlaying(true);
    expect(useUIStore.getState().isPlaying).toBe(true);
  });

  it('clamps learning-rate override to a positive number', () => {
    useUIStore.getState().setLearningRate(0.05);
    expect(useUIStore.getState().learningRate).toBe(0.05);
  });

  it('requests exactly one step and pauses continuous playback', () => {
    useUIStore.getState().setPlaying(true);
    const before = useUIStore.getState().stepRequest;

    useUIStore.getState().stepOnce();

    expect(useUIStore.getState().isPlaying).toBe(false);
    expect(useUIStore.getState().stepRequest).toBe(before + 1);
  });

  it('requests a camera reset without changing the optimization setup', () => {
    useUIStore.getState().setFunctionId('ackley');
    const before = useUIStore.getState().cameraResetRequest;

    useUIStore.getState().resetCameraView();

    expect(useUIStore.getState().cameraResetRequest).toBe(before + 1);
    expect(useUIStore.getState().functionId).toBe('ackley');
  });

  it('restarts the current setup without resetting its controls', () => {
    useUIStore.getState().setFunctionId('ackley');
    useUIStore.getState().setPlaying(true);
    const before = useUIStore.getState().runRevision;

    useUIStore.getState().restart();

    expect(useUIStore.getState().functionId).toBe('ackley');
    expect(useUIStore.getState().isPlaying).toBe(false);
    expect(useUIStore.getState().runRevision).toBe(before + 1);
  });
});

describe('Sim store (Channel B — fast/transient)', () => {
  it('exposes getState/setState/subscribe for transient ref reads', () => {
    let observed = -1;
    const unsub = simStore.subscribe(
      (s) => s.iteration,
      (it) => {
        observed = it;
      },
    );
    simStore.getState().setIteration(7);
    expect(simStore.getState().iteration).toBe(7);
    expect(observed).toBe(7);
    unsub();
  });

  it('updates the current point transiently', () => {
    simStore.getState().setTheta([1.5, -2]);
    expect(simStore.getState().theta).toEqual([1.5, -2]);
  });
});
