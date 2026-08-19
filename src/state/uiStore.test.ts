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
    expect(s.mode).toBe('live');
    expect(s.scrubIndex).toBe(0);
    expect(s.playbackSpeedMs).toBe(250);
    expect(s.tier).toBe('high');
    expect(s.qualityCeiling).toBe('ultra');
    expect(s.runOutcome).toBe('active');
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

  it('locks playback and stepping after a terminal outcome', () => {
    const before = useUIStore.getState().stepRequest;
    useUIStore.getState().setRunOutcome('converged');
    useUIStore.getState().setPlaying(true);
    useUIStore.getState().stepOnce();

    expect(useUIStore.getState().isPlaying).toBe(false);
    expect(useUIStore.getState().stepRequest).toBe(before);

    useUIStore.getState().restart();
    expect(useUIStore.getState().runOutcome).toBe('active');
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

  it('enters review for past entries and returns live at the latest entry', () => {
    useUIStore.getState().setPlaying(true);
    useUIStore.getState().selectHistoryIndex(3, 8);

    expect(useUIStore.getState().mode).toBe('review');
    expect(useUIStore.getState().scrubIndex).toBe(3);
    expect(useUIStore.getState().isPlaying).toBe(false);

    useUIStore.getState().stepHistory(10, 8);
    expect(useUIStore.getState().mode).toBe('live');
    expect(useUIStore.getState().scrubIndex).toBe(8);
  });

  it('clamps manual history navigation to the retained window', () => {
    useUIStore.getState().selectHistoryIndex(-20, 7);
    expect(useUIStore.getState().scrubIndex).toBe(0);
    expect(useUIStore.getState().mode).toBe('review');

    useUIStore.getState().stepHistory(100, 7);
    expect(useUIStore.getState().scrubIndex).toBe(7);
    expect(useUIStore.getState().mode).toBe('live');
  });

  it('autoplays retained entries and stops on the latest entry', () => {
    useUIStore.getState().selectHistoryIndex(1, 3);
    useUIStore.getState().setPlaying(true);
    useUIStore.getState().advanceReviewPlayback(3);

    expect(useUIStore.getState().mode).toBe('review');
    expect(useUIStore.getState().scrubIndex).toBe(2);
    expect(useUIStore.getState().isPlaying).toBe(true);

    useUIStore.getState().advanceReviewPlayback(3);
    expect(useUIStore.getState().mode).toBe('live');
    expect(useUIStore.getState().scrubIndex).toBe(3);
    expect(useUIStore.getState().isPlaying).toBe(false);
  });

  it('allows review playback but blocks live stepping after a terminal run', () => {
    useUIStore.getState().setRunOutcome('diverged');
    useUIStore.getState().selectHistoryIndex(1, 4);
    useUIStore.getState().setPlaying(true);
    const before = useUIStore.getState().stepRequest;
    useUIStore.getState().stepOnce();

    expect(useUIStore.getState().isPlaying).toBe(true);
    expect(useUIStore.getState().stepRequest).toBe(before);
  });

  it('preserves playback speed across run changes and resets review state', () => {
    useUIStore.getState().setPlaybackSpeedMs(125);
    useUIStore.getState().selectHistoryIndex(1, 4);
    useUIStore.getState().restart();

    expect(useUIStore.getState().mode).toBe('live');
    expect(useUIStore.getState().scrubIndex).toBe(0);
    expect(useUIStore.getState().playbackSpeedMs).toBe(125);

    useUIStore.getState().selectHistoryIndex(1, 4);
    useUIStore.getState().setFunctionId('ackley');
    expect(useUIStore.getState().mode).toBe('live');
    expect(useUIStore.getState().scrubIndex).toBe(0);
  });

  it('clamps playback speed to the supported presentation range', () => {
    useUIStore.getState().setPlaybackSpeedMs(20);
    expect(useUIStore.getState().playbackSpeedMs).toBe(62.5);
    useUIStore.getState().setPlaybackSpeedMs(900);
    expect(useUIStore.getState().playbackSpeedMs).toBe(500);
    useUIStore.getState().setPlaybackSpeedMs(Number.NaN);
    expect(useUIStore.getState().playbackSpeedMs).toBe(250);
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
  it('publishes a complete simulation snapshot atomically', () => {
    let notifications = 0;
    const unsubscribe = simStore.subscribe(() => {
      notifications += 1;
    });

    simStore.getState().setSnapshot({
      theta: [2, -3],
      iteration: 9,
      cost: 4.5,
      diverged: false,
    });

    expect(simStore.getState()).toMatchObject({
      theta: [2, -3],
      iteration: 9,
      cost: 4.5,
      diverged: false,
    });
    expect(notifications).toBe(1);
    unsubscribe();
  });
});
