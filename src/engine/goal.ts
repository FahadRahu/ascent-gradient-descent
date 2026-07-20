import type { CostFunction } from './types';

export const GOAL_COST_ABSOLUTE_TOLERANCE = 0.001;
export const GOAL_COST_RELATIVE_TOLERANCE = 0.0001;

export function goalCostForFunction(fn: CostFunction): number | null {
  if (fn.id === 'saddle' || fn.minima.length === 0) return null;

  const costs = fn.minima
    .map((minimum) => fn.cost(minimum))
    .filter(Number.isFinite);
  return costs.length > 0 ? Math.min(...costs) : null;
}

export function isCostAtGoal(currentCost: number, goalCost: number | null): boolean {
  if (goalCost === null || !Number.isFinite(currentCost) || !Number.isFinite(goalCost)) {
    return false;
  }

  const tolerance = Math.max(
    GOAL_COST_ABSOLUTE_TOLERANCE,
    Math.abs(goalCost) * GOAL_COST_RELATIVE_TOLERANCE,
  );
  return Math.abs(currentCost - goalCost) <= tolerance;
}
