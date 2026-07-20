import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { getFunction } from '../engine/functions/registry';
import { makeOptimizer } from '../engine/optimizers/registry';
import { createStepper, type Stepper } from '../engine/stepper';
import type { Vec2 } from '../engine/types';
import { goalCostForFunction, isCostAtGoal } from '../engine/goal';
import { useUIStore } from '../state/uiStore';
import { simStore } from '../state/simStore';
import {
  publishSimRunnerIteration,
  resetSimRunnerHandle,
} from '../state/simHistory';

/**
 * Channel-B handle onto the live run for read-only per-frame consumers (the
 * descent path). The stepper's `history` is the descent polyline; simStore holds
 * only the CURRENT point. `runId` increments on every rebuild so consumers detect
 * a run change (function/optimizer/lr/startPoint) and reset their geometry. Read
 * transiently inside useFrame — never subscribe.
 */
export { getSimRunnerHandle } from '../state/simHistory';

/**
 * Fixed simulation timestep (seconds per optimizer step). Four steps per second
 * leaves enough time to see each move and read its cost change. It remains
 * decoupled from render rate, so the descent is identical at 30/60/120 fps.
 */
export const SIM_DT = 1 / 4;

function publishStepper(stepper: Stepper): void {
  publishSimRunnerIteration(stepper.iteration);

  const last = stepper.history[stepper.history.length - 1];
  const ui = useUIStore.getState();
  const activeFunction = getFunction(ui.functionId);
  const cost = last?.cost ?? activeFunction.cost(stepper.theta);
  const sim = simStore.getState();
  sim.setTheta(stepper.theta);
  sim.setIteration(stepper.iteration);
  sim.setCost(cost);
  sim.setDiverged(stepper.diverged);

  if (stepper.diverged) {
    ui.setRunOutcome('diverged');
  } else if (isCostAtGoal(cost, goalCostForFunction(activeFunction))) {
    ui.setRunOutcome('converged');
  }
}

/**
 * The ONE useFrame that owns the descent (PRD §8.2, the two-channel rule):
 *   - Channel A (reactive): reads uiStore for functionId/optimizer/lr/startPoint
 *     and rebuilds the stepper when any of them change.
 *   - Channel B (transient): every frame (while playing) it advances the stepper
 *     and writes the vanilla simStore via getState() setters — NEVER React state.
 * No other component may write simStore from a frame loop. Must be mounted inside
 * <Canvas> because useFrame requires the R3F render-loop context.
 */
export function useSimRunner(): void {
  const stepperRef = useRef<Stepper | null>(null);
  const handledStepRequest = useRef(useUIStore.getState().stepRequest);
  const wasPlaying = useRef(false);
  const invalidate = useThree((s) => s.invalidate);

  // Channel A → rebuild. Subscribe reactively to the four inputs that define a
  // run. Any change tears down the old stepper, builds a fresh one, and reseeds
  // the sim store to the start point so the ball snaps back to θ₀.
  const functionId = useUIStore((s) => s.functionId);
  const optimizerId = useUIStore((s) => s.optimizerId);
  const learningRate = useUIStore((s) => s.learningRate);
  const startPoint = useUIStore((s) => s.startPoint);
  const runRevision = useUIStore((s) => s.runRevision);
  const stepRequest = useUIStore((s) => s.stepRequest);
  const isPlaying = useUIStore((s) => s.isPlaying);

  useEffect(() => {
    const fn = getFunction(functionId);
    const theta0 = startPoint as Vec2;
    // Newton needs grad to build its numeric Hessian; passing {grad} is harmless
    // for the first-order optimizers (they ignore it).
    const optimizer = makeOptimizer(optimizerId, { lr: learningRate }, { grad: fn.grad });

    const stepper = createStepper({
      optimizer,
      grad: fn.grad,
      theta0,
      dt: SIM_DT,
      cost: fn.cost,
    });
    stepperRef.current = stepper;

    // Publish the fresh run to the Channel-B handle and bump runId so the path
    // resets its geometry to the reseeded single-point history.
    resetSimRunnerHandle(stepper.history);
    useUIStore.getState().setRunOutcome('active');

    // Seed Channel B at θ₀ so the ball is correctly placed even before play.
    const sim = simStore.getState();
    sim.setTheta(theta0);
    sim.setCost(fn.cost(theta0));
    sim.setIteration(0);
    sim.setDiverged(false);

    // We are on frameloop="demand" while paused — force one render so the freshly
    // seeded ball position is drawn immediately.
    invalidate();
  }, [functionId, optimizerId, learningRate, startPoint, runRevision, invalidate]);

  useEffect(() => {
    if (stepRequest === handledStepRequest.current) return;
    handledStepRequest.current = stepRequest;

    // Reset returns the counter to zero; that state change is not a step.
    if (stepRequest === 0) return;

    const stepper = stepperRef.current;
    if (!stepper) return;
    stepper.advance(SIM_DT);
    publishStepper(stepper);
    invalidate();
  }, [stepRequest, invalidate]);

  useEffect(() => {
    if (!isPlaying) wasPlaying.current = false;
  }, [isPlaying]);

  useFrame((_, delta) => {
    const stepper = stepperRef.current;
    if (!stepper) return;

    // Read the play flag transiently (no re-subscription → no stale closure, no
    // re-created frame callback). While paused we early-out; the Canvas is on
    // frameloop="demand" so this callback isn't even pumped, but the guard keeps
    // the hook correct if the frameloop policy changes.
    if (!useUIStore.getState().isPlaying) return;

    // Demand rendering can leave a large clock delta queued while paused. Skip
    // the first resumed frame and cap later stalls so the lesson never catches
    // up by taking many invisible optimizer steps at once.
    if (!wasPlaying.current) {
      wasPlaying.current = true;
      return;
    }

    stepper.advance(Math.min(delta, SIM_DT));
    publishStepper(stepper);
  });
}
