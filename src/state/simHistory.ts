import type { HistoryEntry } from '../engine/stepper';

export interface SimRunnerHandle {
  history: readonly HistoryEntry[];
  iteration: number;
  runId: number;
}

const handle: SimRunnerHandle = { history: [], iteration: 0, runId: 0 };

export function getSimRunnerHandle(): SimRunnerHandle {
  return handle;
}

export function resetSimRunnerHandle(history: readonly HistoryEntry[]): void {
  handle.history = history;
  handle.iteration = 0;
  handle.runId += 1;
}

export function publishSimRunnerIteration(iteration: number): void {
  handle.iteration = iteration;
}
