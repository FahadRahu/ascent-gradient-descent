import {
  ARRIVE_PARAM_FRAC,
  SUSTAIN,
  nearestMinimaDistSq,
  evaluateArrival,
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
