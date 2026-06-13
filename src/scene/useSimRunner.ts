import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { getFunction } from '../engine/functions/registry';
import { makeOptimizer } from '../engine/optimizers/registry';
import { createStepper, type Stepper } from '../engine/stepper';
import type { Vec2 } from '../engine/types';
import { useUIStore } from '../state/uiStore';
import { simStore } from '../state/simStore';

/**
 * Fixed simulation timestep (seconds per optimizer step). 1/30 s ≈ 33 ms/step
 * (~30 steps/s) reads as a clear, teaching-friendly pace — fast enough to feel
 * live, slow enough to follow each step. It is intentionally decoupled from the
 * render frame rate: the stepper is a fixed-timestep accumulator (PRD §8.3), so
 * the descent is identical at 30/60/120 fps. Tunable; a speed control is M1c.
 */
const SIM_DT = 1 / 30;

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
  const invalidate = useThree((s) => s.invalidate);

  // Channel A → rebuild. Subscribe reactively to the four inputs that define a
  // run. Any change tears down the old stepper, builds a fresh one, and reseeds
  // the sim store to the start point so the ball snaps back to θ₀.
  const functionId = useUIStore((s) => s.functionId);
  const optimizerId = useUIStore((s) => s.optimizerId);
  const learningRate = useUIStore((s) => s.learningRate);
  const startPoint = useUIStore((s) => s.startPoint);

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

    // Seed Channel B at θ₀ so the ball is correctly placed even before play.
    const sim = simStore.getState();
    sim.setTheta(theta0);
    sim.setCost(fn.cost(theta0));
    sim.setIteration(0);
    sim.setDiverged(false);

    // We are on frameloop="demand" while paused — force one render so the freshly
    // seeded ball position is drawn immediately.
    invalidate();
  }, [functionId, optimizerId, learningRate, startPoint, invalidate]);

  useFrame((_, delta) => {
    const stepper = stepperRef.current;
    if (!stepper) return;

    // Read the play flag transiently (no re-subscription → no stale closure, no
    // re-created frame callback). While paused we early-out; the Canvas is on
    // frameloop="demand" so this callback isn't even pumped, but the guard keeps
    // the hook correct if the frameloop policy changes.
    if (!useUIStore.getState().isPlaying) return;

    stepper.advance(delta);

    // Write Channel B once per frame from the post-advance stepper. Cost comes
    // from the last history entry the stepper recorded this frame (it computes
    // cost per entry); fall back to recompute only if history is somehow empty.
    const last = stepper.history[stepper.history.length - 1];
    const sim = simStore.getState();
    sim.setTheta(stepper.theta);
    sim.setIteration(stepper.iteration);
    sim.setCost(last?.cost ?? getFunction(useUIStore.getState().functionId).cost(stepper.theta));
    sim.setDiverged(stepper.diverged);
  });
}
