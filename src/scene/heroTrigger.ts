import type { Domain } from './surfaceMapping.types';
import type { Vec2 } from '../engine/types';

/**
 * Arrival trigger (spec §5.6). Composite predicate:
 *   PRIMARY  — proximity: θ within ARRIVE_PARAM_FRAC of the NEAREST authored
 *              minimum (normalized by the larger domain axis).
 *   FALLBACK — convergence: |Δcost|/|cost| < COST_EPS for SUSTAIN consecutive
 *              steps (handles optimizers that stall short of the listed minimum,
 *              and saddle which has no attractor).
 * Either condition arms the one-shot beat. Pure — no Three/React.
 */

/** Param-space fraction of the larger domain extent that counts as "arrived". */
export const ARRIVE_PARAM_FRAC = 0.04;
/** Relative cost-delta below which a step counts as "converging". */
export const COST_EPS = 1e-4;
/** Consecutive converging steps required for the fallback to fire. */
export const SUSTAIN = 20;

/** Squared distance from p to the nearest minimum (param space). */
export function nearestMinimaDistSq(p: Vec2, minima: readonly Vec2[]): number {
  let best = Infinity;
  for (const m of minima) {
    const dx = p[0] - m[0];
    const dy = p[1] - m[1];
    const d2 = dx * dx + dy * dy;
    if (d2 < best) best = d2;
  }
  return best;
}

export interface ArrivalSignals {
  theta: Vec2;
  cost: number;
  /** Cost on the previous evaluated optimizer step (NaN on the first). */
  prevCost: number;
  minima: readonly Vec2[];
  domain: Domain;
  /** Running count of consecutive converging optimizer steps. */
  convergedRun: number;
}

export interface ArrivalResult {
  arrived: boolean;
  /** Whether this optimizer step was converging. */
  converging: boolean;
  /** Normalized param distance to the nearest minimum (debugging/telemetry). */
  paramDist: number;
}

export function evaluateArrival(s: ArrivalSignals): ArrivalResult {
  const [xMin, xMax, yMin, yMax] = s.domain;
  const extent = Math.max(xMax - xMin, yMax - yMin);
  const dist = Math.sqrt(nearestMinimaDistSq(s.theta, s.minima));
  const paramDist = dist / extent;

  const proximityArrived = paramDist < ARRIVE_PARAM_FRAC;

  const denom = Math.max(Math.abs(s.cost), 1e-9);
  const converging =
    Number.isFinite(s.prevCost) && Math.abs(s.cost - s.prevCost) / denom < COST_EPS;
  const convergenceArrived = converging && s.convergedRun + 1 >= SUSTAIN;

  return { arrived: proximityArrived || convergenceArrived, converging, paramDist };
}

export interface ArrivalSample {
  runId: number;
  iteration: number;
  theta: Vec2;
  cost: number;
  minima: readonly Vec2[];
  domain: Domain;
}

export interface ArrivalTracker {
  runId: number;
  iteration: number;
  prevCost: number;
  convergedRun: number;
}

export interface TrackedArrival {
  tracker: ArrivalTracker;
  result: ArrivalResult;
  evaluatedStep: boolean;
}

export function createArrivalTracker(): ArrivalTracker {
  return {
    runId: -1,
    iteration: -1,
    prevCost: NaN,
    convergedRun: 0,
  };
}

/**
 * Evaluate convergence at most once per optimizer iteration. Proximity remains
 * responsive on every render frame, while the fallback counter is tied to the
 * simulation clock and resets whenever the run changes.
 */
export function trackArrival(
  current: ArrivalTracker,
  sample: ArrivalSample,
): TrackedArrival {
  const runChanged = sample.runId !== current.runId;
  const tracker = runChanged
    ? { ...createArrivalTracker(), runId: sample.runId }
    : current;
  const iterationChanged = sample.iteration !== tracker.iteration;

  if (!iterationChanged) {
    const result = evaluateArrival({
      theta: sample.theta,
      cost: sample.cost,
      prevCost: NaN,
      minima: sample.minima,
      domain: sample.domain,
      convergedRun: 0,
    });
    return {
      tracker,
      result: { ...result, converging: false },
      evaluatedStep: false,
    };
  }

  const result = evaluateArrival({
    theta: sample.theta,
    cost: sample.cost,
    prevCost: tracker.prevCost,
    minima: sample.minima,
    domain: sample.domain,
    convergedRun: tracker.convergedRun,
  });

  return {
    tracker: {
      runId: sample.runId,
      iteration: sample.iteration,
      prevCost: sample.cost,
      convergedRun: result.converging ? tracker.convergedRun + 1 : 0,
    },
    result,
    evaluatedStep: true,
  };
}
