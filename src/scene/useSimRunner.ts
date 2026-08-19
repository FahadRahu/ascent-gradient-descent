import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { getFunction } from '../engine/functions/registry';
import { makeOptimizer } from '../engine/optimizers/registry';
import { createStepper, type Stepper } from '../engine/stepper';
import type { Vec2 } from '../engine/types';
import { goalCostForFunction, isCostAtGoal } from '../engine/goal';
import { resolveHistorySelection } from '../state/playbackHistory';
import { useUIStore } from '../state/uiStore';
import { simStore } from '../state/simStore';
import {
  publishSimRunnerIteration,
  resetSimRunnerHandle,
} from '../state/simHistory';

/**
 * Channel-B handle onto the live run for read-only per-frame consumers. The
 * stepper owns the retained history and latest optimizer state; review mode only
 * changes which recorded entry is presented through simStore.
 */
export { getSimRunnerHandle } from '../state/simHistory';

/** Four optimizer steps per second at the default 1x presentation speed. */
export const SIM_DT = 1 / 4;

export function simulationElapsedForFrame(
  delta: number,
  playbackSpeedMs: number,
): number {
  const speedMs = Number.isFinite(playbackSpeedMs)
    ? Math.min(500, Math.max(62.5, playbackSpeedMs))
    : SIM_DT * 1000;
  const speedMultiplier = (SIM_DT * 1000) / speedMs;
  return Math.min(delta, speedMs / 1000) * speedMultiplier;
}

function publishStepper(stepper: Stepper): void {
  publishSimRunnerIteration(stepper.iteration);

  const last = stepper.history[stepper.history.length - 1];
  const ui = useUIStore.getState();
  const activeFunction = getFunction(ui.functionId);
  const cost = last?.cost ?? activeFunction.cost(stepper.theta);
  simStore.getState().setSnapshot({
    theta: stepper.theta,
    iteration: stepper.iteration,
    cost,
    diverged: stepper.diverged,
  });

  if (stepper.diverged) {
    ui.setRunOutcome('diverged');
  } else if (isCostAtGoal(cost, goalCostForFunction(activeFunction))) {
    ui.setRunOutcome('converged');
  }
}

function publishReviewEntry(stepper: Stepper, scrubIndex: number): void {
  const selection = resolveHistorySelection(
    stepper.history,
    'review',
    scrubIndex,
  );
  if (!selection.selected) return;

  simStore.getState().setSnapshot({
    theta: selection.selected.theta,
    iteration: selection.selected.iteration,
    cost: selection.selected.cost,
    diverged: false,
  });
}

/**
 * The one frame-loop owner for the numerical descent. Live mode advances the
 * real stepper; review mode only publishes immutable retained entries and never
 * rewinds optimizer internals.
 */
export function useSimRunner(): void {
  const stepperRef = useRef<Stepper | null>(null);
  const handledStepRequest = useRef(useUIStore.getState().stepRequest);
  const wasPlaying = useRef(false);
  const invalidate = useThree((state) => state.invalidate);

  const functionId = useUIStore((state) => state.functionId);
  const optimizerId = useUIStore((state) => state.optimizerId);
  const learningRate = useUIStore((state) => state.learningRate);
  const startPoint = useUIStore((state) => state.startPoint);
  const runRevision = useUIStore((state) => state.runRevision);
  const stepRequest = useUIStore((state) => state.stepRequest);
  const isPlaying = useUIStore((state) => state.isPlaying);
  const mode = useUIStore((state) => state.mode);
  const scrubIndex = useUIStore((state) => state.scrubIndex);

  useEffect(() => {
    const fn = getFunction(functionId);
    const theta0 = startPoint as Vec2;
    const optimizer = makeOptimizer(
      optimizerId,
      { lr: learningRate },
      { grad: fn.grad },
    );

    const stepper = createStepper({
      optimizer,
      grad: fn.grad,
      theta0,
      dt: SIM_DT,
      cost: fn.cost,
    });
    stepperRef.current = stepper;

    resetSimRunnerHandle(stepper.history);
    useUIStore.getState().setRunOutcome('active');
    simStore.getState().setSnapshot({
      theta: theta0,
      iteration: 0,
      cost: fn.cost(theta0),
      diverged: false,
    });
    invalidate();
  }, [functionId, optimizerId, learningRate, startPoint, runRevision, invalidate]);

  useEffect(() => {
    if (stepRequest === handledStepRequest.current) return;
    handledStepRequest.current = stepRequest;
    if (stepRequest === 0) return;

    const stepper = stepperRef.current;
    if (!stepper || useUIStore.getState().mode !== 'live') return;
    stepper.advance(SIM_DT);
    publishStepper(stepper);
    invalidate();
  }, [stepRequest, invalidate]);

  useEffect(() => {
    const stepper = stepperRef.current;
    if (!stepper) return;

    if (mode === 'review') {
      publishReviewEntry(stepper, scrubIndex);
    } else {
      publishStepper(stepper);
    }
    invalidate();
  }, [mode, scrubIndex, invalidate]);

  useEffect(() => {
    if (!isPlaying || mode !== 'live') wasPlaying.current = false;
  }, [isPlaying, mode]);

  useFrame((_, delta) => {
    const stepper = stepperRef.current;
    if (!stepper) return;

    const ui = useUIStore.getState();
    if (ui.mode !== 'live' || !ui.isPlaying) return;

    if (!wasPlaying.current) {
      wasPlaying.current = true;
      return;
    }

    stepper.advance(simulationElapsedForFrame(delta, ui.playbackSpeedMs));
    publishStepper(stepper);
  });
}
