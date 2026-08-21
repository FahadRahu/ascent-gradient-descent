import {
  CircleCheck,
  Crosshair,
  LoaderCircle,
  Pause,
  Play,
  RotateCcw,
  StepForward,
  TriangleAlert,
} from 'lucide-react';
import { useUIStore } from '../state/uiStore';
import type { GraphicsStatus } from './GraphicsState';

export function SimulationTransport({
  graphicsStatus,
}: {
  graphicsStatus: GraphicsStatus;
}) {
  const isPlaying = useUIStore((state) => state.isPlaying);
  const mode = useUIStore((state) => state.mode);
  const runOutcome = useUIStore((state) => state.runOutcome);
  const setPlaying = useUIStore((state) => state.setPlaying);
  const stepOnce = useUIStore((state) => state.stepOnce);
  const resetCameraView = useUIStore((state) => state.resetCameraView);
  const restart = useUIStore((state) => state.restart);
  const controlsReady = graphicsStatus === 'ready';
  const reviewing = mode === 'review';
  const runTerminal = runOutcome !== 'active';

  const primaryLabel = graphicsStatus === 'loading'
    ? 'Loading view'
    : graphicsStatus === 'unavailable'
      ? 'Unavailable'
      : reviewing
        ? 'Reviewing history'
        : runOutcome === 'converged'
          ? 'Minimum reached'
          : runOutcome === 'diverged'
            ? 'Run stopped'
            : isPlaying
              ? 'Pause'
              : 'Run descent';

  return (
    <div
      className="transport"
      role="group"
      aria-label="Simulation controls"
      aria-busy={graphicsStatus === 'loading'}
      data-tour="transport"
    >
      <button
        type="button"
        className="primary-action"
        aria-pressed={mode === 'live' && isPlaying}
        disabled={!controlsReady || runTerminal || reviewing}
        onClick={() => setPlaying(!isPlaying)}
      >
        {graphicsStatus === 'loading' ? (
          <LoaderCircle className="control-spinner" size={17} aria-hidden="true" />
        ) : graphicsStatus === 'unavailable' ? (
          <TriangleAlert size={17} aria-hidden="true" />
        ) : runOutcome === 'converged' && !reviewing ? (
          <CircleCheck size={17} aria-hidden="true" />
        ) : isPlaying && !reviewing ? (
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
        disabled={!controlsReady || runTerminal || reviewing}
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
