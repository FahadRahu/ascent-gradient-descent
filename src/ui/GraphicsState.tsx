import { LoaderCircle, RotateCcw, TriangleAlert } from 'lucide-react';

export type GraphicsStatus = 'loading' | 'ready' | 'unavailable';

interface GraphicsStateProps {
  status: Exclude<GraphicsStatus, 'ready'>;
  onRetry?: () => void;
}

export function GraphicsState({ status, onRetry }: GraphicsStateProps) {
  if (status === 'loading') {
    return (
      <div className="graphics-state graphics-state-loading" role="status" aria-live="polite">
        <LoaderCircle size={22} aria-hidden="true" />
        <span>Preparing the cost landscape</span>
      </div>
    );
  }

  return (
    <div className="graphics-state graphics-state-error" role="alert">
      <TriangleAlert size={24} aria-hidden="true" />
      <div>
        <strong>3D visualization unavailable</strong>
        <p>
          Your browser could not start the graphics view. The experiment is paused
          so the cost readout does not show misleading values.
        </p>
      </div>
      {onRetry ? (
        <button type="button" className="secondary-action" onClick={onRetry}>
          <RotateCcw size={16} aria-hidden="true" />
          <span>Retry graphics</span>
        </button>
      ) : null}
    </div>
  );
}
