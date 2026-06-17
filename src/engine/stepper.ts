import type { CostFn, GradFn, Optimizer, OptimizerState, Vec2 } from './types';

export interface StepperConfig {
  optimizer: Optimizer;
  grad: GradFn;
  /** Cost of the active function — recorded on every history entry (incl. the
   *  initial point) for the iteration scrubber and the cost-vs-iteration readout. */
  cost: CostFn;
  theta0: Vec2;
  /** Fixed simulation timestep in seconds (one optimizer step per dt). */
  dt: number;
  /** Max retained history entries (ring buffer). Oldest are dropped first so the
   *  array stays bounded under a sustained 60fps single-step cadence. Default 4096
   *  — the scrubber window. */
  historyCap?: number;
}

/** A single recorded frame of the descent, for the iteration scrubber (M1). */
export interface HistoryEntry {
  iteration: number;
  theta: Vec2;
  cost: number;
}

export interface Stepper {
  readonly theta: Vec2;
  readonly iteration: number;
  /** Fractional progress toward the next step (0..1) for render interpolation. */
  readonly alpha: number;
  readonly diverged: boolean;
  readonly history: readonly HistoryEntry[];
  /** Advance simulation time by `elapsed` seconds, taking whole steps. */
  advance(elapsed: number): void;
  /** Reset to the initial point and clear state/history. */
  reset(): void;
}

const DEFAULT_HISTORY_CAP = 4096;

/**
 * Fixed-timestep accumulator (PRD §8.3): accumulates real elapsed time and
 * takes deterministic whole optimizer steps when it crosses dt, so behavior is
 * refresh-rate independent. Guards non-finite values (PRD §4.4): on NaN/Inf it
 * retains the last finite point, flags `diverged`, and stops stepping. History
 * is a bounded ring buffer (oldest dropped first) and records cost per entry.
 */
export function createStepper(config: StepperConfig): Stepper {
  const { optimizer, grad, cost, theta0, dt } = config;
  const historyCap = config.historyCap ?? DEFAULT_HISTORY_CAP;

  let theta: Vec2 = theta0;
  let state: OptimizerState = optimizer.init(theta0);
  let accumulator = 0;
  let diverged = false;
  let history: HistoryEntry[] = [{ iteration: 0, theta: theta0, cost: cost(theta0) }];

  const isFinitePair = (v: Vec2): boolean => Number.isFinite(v[0]) && Number.isFinite(v[1]);

  const record = (iteration: number, t: Vec2, c: number): void => {
    history.push({ iteration, theta: t, cost: c });
    if (history.length > historyCap) history.shift(); // drop oldest; history[0] = oldest retained — O(n); fine at 4096, revisit for M1c if a larger cap is used
  };

  return {
    get theta() {
      return theta;
    },
    get iteration() {
      return state.iteration;
    },
    get alpha() {
      return Math.min(accumulator / dt, 1);
    },
    get diverged() {
      return diverged;
    },
    get history() {
      return history;
    },
    advance(elapsed: number) {
      if (diverged) return;
      accumulator += elapsed;
      while (accumulator >= dt) {
        accumulator -= dt;
        const result = optimizer.step(theta, grad, state);
        // Divergence = the new point is non-finite in EITHER theta or cost. Cost
        // can overflow (e.g. Rosenbrock ≈100·x⁴ → Infinity) while theta is still
        // finite, so guard the cost too — otherwise a non-finite cost would be
        // recorded into history and flow into the path/trail world-height math as
        // NaN/Inf (crashing TubeGeometry/MeshLine). Retain the last point where
        // BOTH were finite; stop. (Contract in this file's header docstring.)
        const nextCost = cost(result.theta);
        if (!isFinitePair(result.theta) || !Number.isFinite(nextCost)) {
          diverged = true; // keep the last finite theta+cost; stop
          return;
        }
        theta = result.theta;
        state = result.state;
        record(state.iteration, theta, nextCost);
      }
    },
    reset() {
      theta = theta0;
      state = optimizer.init(theta0);
      accumulator = 0;
      diverged = false;
      history = [{ iteration: 0, theta: theta0, cost: cost(theta0) }];
    },
  };
}
