import { createStepper } from './stepper';
import { makeSGD } from './optimizers';
import { getFunction } from './functions';
import type { CostFn, GradFn, Vec2 } from './types';

const grad: GradFn = (t: Vec2) => [2 * t[0], 2 * t[1]];
const cost: CostFn = (t: Vec2) => t[0] * t[0] + t[1] * t[1]; // x²+y², matches the grad above

describe('fixed-timestep stepper', () => {
  it('advances exactly one step when elapsed >= dt', () => {
    const opt = makeSGD({ lr: 0.1 });
    const s = createStepper({ optimizer: opt, grad, cost, theta0: [1, 1], dt: 0.1 });
    s.advance(0.1); // exactly one dt
    expect(s.iteration).toBe(1);
    expect(s.theta[0]).toBeCloseTo(0.8, 12);
  });

  it('advances multiple steps for a large elapsed time (accumulator)', () => {
    const opt = makeSGD({ lr: 0.1 });
    const s = createStepper({ optimizer: opt, grad, cost, theta0: [1, 1], dt: 0.1 });
    s.advance(0.35); // 3 whole steps, 0.05 left over
    expect(s.iteration).toBe(3);
    expect(s.theta[0]).toBeCloseTo(0.512, 10); // 1·0.8^3
  });

  it('does not step until dt is reached; exposes interpolation alpha', () => {
    const opt = makeSGD({ lr: 0.1 });
    const s = createStepper({ optimizer: opt, grad, cost, theta0: [1, 1], dt: 0.1 });
    s.advance(0.05);
    expect(s.iteration).toBe(0);
    expect(s.alpha).toBeCloseTo(0.5, 6); // halfway to the next step
  });

  it('reset returns to the initial point and clears state', () => {
    const opt = makeSGD({ lr: 0.1 });
    const s = createStepper({ optimizer: opt, grad, cost, theta0: [1, 1], dt: 0.1 });
    s.advance(0.3);
    s.reset();
    expect(s.iteration).toBe(0);
    expect(s.theta).toEqual([1, 1]);
  });

  it('flags divergence and stops when a step produces non-finite values', () => {
    // Huge LR on Rosenbrock from a steep point → overflow to Infinity.
    const opt = makeSGD({ lr: 1e6 });
    const ros = getFunction('rosenbrock');
    const s = createStepper({ optimizer: opt, grad: ros.grad, cost: ros.cost, theta0: [-1.5, -1], dt: 0.1 });
    s.advance(1.0); // would be 10 steps, but it diverges first
    expect(s.diverged).toBe(true);
    expect(s.theta.every(Number.isFinite)).toBe(true); // last finite point retained
  });

  it('records history of points for the scrubber (M1)', () => {
    const opt = makeSGD({ lr: 0.1 });
    const s = createStepper({ optimizer: opt, grad, cost, theta0: [1, 1], dt: 0.1 });
    s.advance(0.2);
    expect(s.history.length).toBe(3); // initial + 2 steps
    expect(s.history[0].theta).toEqual([1, 1]);
  });

  it('records cost on every history entry including the initial one', () => {
    const opt = makeSGD({ lr: 0.1 });
    const sphere = getFunction('sphere');
    const s = createStepper({ optimizer: opt, grad: sphere.grad, cost: sphere.cost, theta0: [1, 1], dt: 0.1 });
    expect(s.history[0].cost).toBeCloseTo(2, 12); // cost([1,1]) = 1²+1² = 2
    s.advance(0.1); // one step → θ=[0.8,0.8]
    expect(s.history).toHaveLength(2);
    expect(s.history[1].theta[0]).toBeCloseTo(0.8, 12);
    expect(s.history[1].cost).toBeCloseTo(0.8 * 0.8 + 0.8 * 0.8, 12); // 1.28
    expect(s.history.every((h) => typeof h.cost === 'number')).toBe(true);
  });

  it('caps history at historyCap and drops the oldest entry (ring buffer)', () => {
    const opt = makeSGD({ lr: 0.1 });
    const sphere = getFunction('sphere');
    const s = createStepper({
      optimizer: opt,
      grad: sphere.grad,
      cost: sphere.cost,
      theta0: [1, 1],
      dt: 0.1,
      historyCap: 4,
    });
    s.advance(0.6); // 6 whole steps; without a cap history would be length 7 (initial + 6)
    expect(s.history).toHaveLength(4); // capped
    expect(s.history[0].iteration).toBe(3); // oldest RETAINED (iterations 0,1,2 dropped)
    expect(s.history[s.history.length - 1].iteration).toBe(6); // newest
  });
});
