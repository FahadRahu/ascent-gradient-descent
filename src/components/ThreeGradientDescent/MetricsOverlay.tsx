/**
 * MetricsOverlay Component
 *
 * A compact 2D HTML overlay that displays real-time metrics for the gradient descent
 * visualization. Designed to be minimal and non-intrusive.
 *
 * Features:
 * - Compact single-row design for minimal footprint
 * - Color-coded cost value (red→yellow→green)
 * - Responsive: horizontal on desktop, stacked on mobile
 * - Theme-aware (dark/light mode)
 */

import { useMemo } from 'react';
import { cn } from '@/utils/cn';
import { GradientDescentPoint } from './types';

interface MetricsOverlayProps {
  /** Current point in the gradient descent */
  currentPoint: GradientDescentPoint | null;
  /** Total steps in the path */
  totalSteps: number;
  /** Whether to show the overlay */
  show: boolean;
  /** Theme mode */
  isDark: boolean;
}

/**
 * Format cost value for compact display
 */
function formatCost(cost: number): string {
  if (!isFinite(cost)) return cost > 0 ? '∞' : '-∞';

  if (Math.abs(cost) >= 100) {
    return cost.toFixed(0);
  }

  if (Math.abs(cost) >= 10) {
    return cost.toFixed(1);
  }

  if (Math.abs(cost) < 0.01 && cost !== 0) {
    return cost.toExponential(1);
  }

  return cost.toFixed(2);
}

/**
 * Format parameter value for compact display
 */
function formatParam(value: number): string {
  if (!isFinite(value)) return value > 0 ? '∞' : '-∞';
  return value.toFixed(2);
}

/**
 * Get color based on cost value
 */
function getCostColor(cost: number, isDark: boolean): string {
  if (cost > 8) {
    return isDark ? '#f87171' : '#dc2626'; // red
  } else if (cost > 2) {
    return isDark ? '#fb923c' : '#ea580c'; // orange
  } else if (cost > 0.5) {
    return isDark ? '#facc15' : '#ca8a04'; // yellow
  } else {
    return isDark ? '#4ade80' : '#16a34a'; // green
  }
}

export function MetricsOverlay({
  currentPoint,
  totalSteps: _totalSteps,
  show,
  isDark,
}: MetricsOverlayProps) {
  const costColor = useMemo(() => {
    if (!currentPoint) return getCostColor(999, isDark);
    return getCostColor(currentPoint.cost, isDark);
  }, [currentPoint, isDark]);

  if (!show || !currentPoint) return null;

  return (
    <div
      className={cn(
        'absolute top-2 left-2 z-10',
        'rounded-lg',
        'backdrop-blur-sm',
        'border',
        'shadow-md',
        'pointer-events-none',
        'select-none',
        'text-xs',
        isDark ? 'bg-dark-900/75 border-dark-600/40' : 'bg-white/75 border-slate-300/40'
      )}
    >
      {/* Compact horizontal layout */}
      <div className="flex items-center gap-2 px-2.5 py-1.5 sm:gap-3 sm:px-3">
        {/* Cost - primary metric */}
        <div className="flex items-center gap-1">
          <span className={cn('font-medium', isDark ? 'text-dark-400' : 'text-slate-500')}>J:</span>
          <span className="font-mono font-bold" style={{ color: costColor }}>
            {formatCost(currentPoint.cost)}
          </span>
        </div>

        {/* Divider */}
        <div className={cn('w-px h-3', isDark ? 'bg-dark-600' : 'bg-slate-300')} />

        {/* Position - compact */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className={cn('font-mono', isDark ? 'text-orange-400/80' : 'text-orange-600/80')}>
            w:{' '}
            <span className={isDark ? 'text-white' : 'text-slate-900'}>
              {formatParam(currentPoint.w)}
            </span>
          </span>
          <span className={cn('font-mono', isDark ? 'text-cyan-400/80' : 'text-cyan-600/80')}>
            b:{' '}
            <span className={isDark ? 'text-white' : 'text-slate-900'}>
              {formatParam(currentPoint.b)}
            </span>
          </span>
        </div>

        {/* Divider */}
        <div className={cn('w-px h-3 hidden sm:block', isDark ? 'bg-dark-600' : 'bg-slate-300')} />

        {/* Step - hidden on very small screens */}
        <div
          className={cn(
            'hidden sm:flex items-center gap-1',
            isDark ? 'text-dark-400' : 'text-slate-500'
          )}
        >
          <span className="font-mono">#{currentPoint.iteration}</span>
        </div>
      </div>
    </div>
  );
}

export default MetricsOverlay;
