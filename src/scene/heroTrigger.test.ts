import {
  ARRIVE_PARAM_FRAC,
  SUSTAIN,
  createArrivalTracker,
  nearestMinimaDistSq,
  evaluateArrival,
  trackArrival,
} from './heroTrigger';
import { getFunction } from '../engine/functions';
import type { Vec2 } from '../engine/types';

describe('heroTrigger — arrival predicate', () => {
  const sphere = getFunction('sphere'); // minima [[0,0]], domain [-5,5,-5,5]
  const himmel = getFunction('himmelblau'); // 4 minima

  it('nearestMinimaDistSq picks the closest minimum', () => {
    const near = [3.1, 1.9] as Vec2; // close to [3,2]
    const d2 = nearestMinimaDistSq(near, himmel.minima as Vec2[]);
    expect(d2).toBeLessThan(0.05);
  });

  it('fires (proximity) when theta is within ARRIVE_PARAM_FRAC of a minimum', () => {
    const r = evaluateArrival({
      theta: [0.05, -0.05],
      cost: 0.005,
      prevCost: 0.006,
      minima: sphere.minima as Vec2[],
      domain: sphere.domain,
      convergedRun: 0,
    });
    expect(r.arrived).toBe(true); // dist/extent ≈ 0.007 < ARRIVE_PARAM_FRAC (0.04)
    expect(r.paramDist).toBeLessThan(ARRIVE_PARAM_FRAC);
  });

  it('does NOT fire mid-descent far from any minimum', () => {
    const r = evaluateArrival({
      theta: [-1.2, 1],
      cost: 24,
      prevCost: 30,
      minima: sphere.minima as Vec2[],
      domain: sphere.domain,
      convergedRun: 0,
    });
    expect(r.arrived).toBe(false);
  });

  it('fires (convergence fallback) after SUSTAIN near-zero-delta steps, even far away', () => {
    // Far from the minimum, but cost has plateaued: the run is stuck.
    const sig = {
      theta: [4, 4] as Vec2,
      cost: 100.0,
      prevCost: 100.000001, // |Δ|/|cost| well below COST_EPS
      minima: sphere.minima as Vec2[],
      domain: sphere.domain,
      convergedRun: SUSTAIN - 1, // one more converging step trips it
    };
    const r = evaluateArrival(sig);
    expect(r.converging).toBe(true);
    expect(r.arrived).toBe(true);
  });

  it('never counts the first frame (prevCost NaN) as converging', () => {
    const r = evaluateArrival({
      theta: [4, 4],
      cost: 100,
      prevCost: NaN,
      minima: sphere.minima as Vec2[],
      domain: sphere.domain,
      convergedRun: SUSTAIN,
    });
    expect(r.converging).toBe(false);
    expect(r.arrived).toBe(false);
  });
});

describe('heroTrigger - optimizer-step tracking', () => {
  const sphere = getFunction('sphere');
  const farFromMinimum = [4, 4] as Vec2;

  function sample(runId: number, iteration: number, cost: number) {
    return {
      runId,
      iteration,
      theta: farFromMinimum,
      cost,
      minima: sphere.minima as readonly Vec2[],
      domain: sphere.domain,
    };
  }

  it.each([60, 90, 120, 144])(
    'does not count repeated render frames at %i Hz',
    (refreshRate) => {
      let tracker = createArrivalTracker();
      const framesBeforeOptimizerStep = Math.ceil(refreshRate * 0.25);

      for (let frame = 0; frame < framesBeforeOptimizerStep; frame += 1) {
        const tracked = trackArrival(tracker, sample(1, 0, 100));
        tracker = tracked.tracker;
        expect(tracked.result.arrived).toBe(false);
      }

      expect(tracker.convergedRun).toBe(0);
      expect(tracker.iteration).toBe(0);
    },
  );

  it('fires the fallback after twenty real low-delta optimizer iterations', () => {
    let tracker = createArrivalTracker();
    tracker = trackArrival(tracker, sample(1, 0, 100)).tracker;

    for (let iteration = 1; iteration <= SUSTAIN; iteration += 1) {
      let tracked = trackArrival(
        tracker,
        sample(1, iteration, 100 - iteration * 0.000001),
      );
      tracker = tracked.tracker;
      expect(tracked.result.arrived).toBe(iteration === SUSTAIN);

      for (let renderFrame = 0; renderFrame < 12; renderFrame += 1) {
        tracked = trackArrival(
          tracker,
          sample(1, iteration, 100 - iteration * 0.000001),
        );
        tracker = tracked.tracker;
      }

      expect(tracked.evaluatedStep).toBe(false);
      expect(tracker.convergedRun).toBe(iteration);
    }
  });

  it('resets previous cost and sustained convergence when the run changes', () => {
    let tracker = createArrivalTracker();
    tracker = trackArrival(tracker, sample(1, 0, 100)).tracker;
    for (let iteration = 1; iteration < SUSTAIN; iteration += 1) {
      tracker = trackArrival(
        tracker,
        sample(1, iteration, 100 - iteration * 0.000001),
      ).tracker;
    }
    expect(tracker.convergedRun).toBe(SUSTAIN - 1);

    const nextRun = trackArrival(tracker, sample(2, 0, 50));
    expect(nextRun.result.arrived).toBe(false);
    expect(nextRun.result.converging).toBe(false);
    expect(nextRun.tracker).toMatchObject({
      runId: 2,
      iteration: 0,
      prevCost: 50,
      convergedRun: 0,
    });
  });
});
