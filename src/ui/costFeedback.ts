import { isCostAtGoal } from '../engine/goal';

export type CostStepState =
  | 'ready'
  | 'decreased'
  | 'increased'
  | 'unchanged'
  | 'reached'
  | 'diverged';

export interface CostStepFeedback {
  state: CostStepState;
  change: number;
}

export function classifyCostStep(
  previousCost: number | null,
  currentCost: number,
  goalCost: number | null,
  diverged: boolean,
): CostStepFeedback {
  if (diverged || !Number.isFinite(currentCost)) {
    return { state: 'diverged', change: 0 };
  }

  if (isCostAtGoal(currentCost, goalCost)) {
    return {
      state: 'reached',
      change: previousCost === null ? 0 : Math.abs(currentCost - previousCost),
    };
  }

  if (previousCost === null || !Number.isFinite(previousCost)) {
    return { state: 'ready', change: 0 };
  }

  const signedChange = currentCost - previousCost;
  const flatTolerance = Math.max(1e-9, Math.abs(previousCost) * 1e-9);
  if (Math.abs(signedChange) <= flatTolerance) {
    return { state: 'unchanged', change: Math.abs(signedChange) };
  }

  return {
    state: signedChange < 0 ? 'decreased' : 'increased',
    change: Math.abs(signedChange),
  };
}
