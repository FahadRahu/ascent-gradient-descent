import {
  CircleCheck,
  Crosshair,
  Pause,
  Play,
  RotateCcw,
  StepForward,
} from 'lucide-react';
import { useUIStore } from '../state/uiStore';
import type { GraphicsStatus } from './GraphicsState';

export function SimulationTransport({
  graphicsStatus,
}: {
  graphicsStatus: GraphicsStatus;
}) {
  const isPlaying = useUIStore((state) => state.isPlaying);
  const runOutcome = useUIStore((state) => state.runOutcome);
  const setPlaying = useUIStore((state) => state.setPlaying);
  const stepOnce = useUIStore((state) => state.stepOnce);
  const resetCameraView = useUIStore((state) => state.resetCameraView);
  const restart = useUIStore((state) => state.restart);
  const controlsReady = graphicsStatus === 'ready';
  const runTerminal = runOutcome !== 'active';

  const primaryLabel = graphicsStatus === 'loading'
    ? 'Loading view'
    : graphicsStatus === 'unavailable'
      ? 'Unavailable'
      : runOutcome === 'converged'
        ? 'Minimum reached'
        : runOutcome === 'diverged'
          ? 'Run stopped'
          : isPlaying
            ? 'Pause'
            : 'Run descent';

  return (
    <div className="transport" role="group" aria-label="Simulation controls">
      <button
        type="button"
        className="primary-action"
        aria-pressed={isPlaying}
        disabled={!controlsReady || runTerminal}
        onClick={() => setPlaying(!isPlaying)}
      >
        {runOutcome === 'converged' ? (
          <CircleCheck size={17} aria-hidden="true" />
        ) : isPlaying ? (
          <Pause size={17} fill="currentColor" aria-hidden="true" />
        ) : (
          <Play size={17} fill="currentColor" aria-hidden="true" />
        )}
        <span>{primaryLabel}</span>
      </button>
      <button
        type="button"
        className="secondary-action"
        aria-label="Advance one iteration"
        title="Advance exactly one iteration"
        disabled={!controlsReady || runTerminal}
        onClick={stepOnce}
      >
        <StepForward size={17} aria-hidden="true" />
        <span>Step once</span>
      </button>
      <button
        type="button"
        className="icon-button"
        aria-label="Restart optimization"
        title="Restart optimization"
        disabled={!controlsReady}
        onClick={restart}
      >
        <RotateCcw size={17} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="icon-button"
        aria-label="Reset camera view"
        title="Reset camera view"
        disabled={!controlsReady}
        onClick={resetCameraView}
      >
        <Crosshair size={17} aria-hidden="true" />
      </button>
    </div>
  );
}
