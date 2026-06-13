import { makeSGD } from './sgd';
import type { GradFn, Vec2 } from '../types';

// Test landscape: f = x^2 + y^2 → grad = [2x, 2y].
const grad: GradFn = (t: Vec2) => [2 * t[0], 2 * t[1]];

describe('SGD', () => {
  it('θ -= η·g with η=0.1: from (1,1) → (0.8,0.8) then (0.64,0.64)', () => {
    const opt = makeSGD({ lr: 0.1 });
    let state = opt.init([1, 1]);
    let theta: Vec2 = [1, 1];

    ({ theta, state } = opt.step(theta, grad, state));
    expect(theta[0]).toBeCloseTo(0.8, 12);
    expect(theta[1]).toBeCloseTo(0.8, 12);

    ({ theta, state } = opt.step(theta, grad, state));
    expect(theta[0]).toBeCloseTo(0.64, 12);
    expect(theta[1]).toBeCloseTo(0.64, 12);
  });

  it('iteration counter advances', () => {
    const opt = makeSGD({ lr: 0.1 });
    let state = opt.init([1, 1]);
    expect(state.iteration).toBe(0);
    ({ state } = opt.step([1, 1], grad, state));
    expect(state.iteration).toBe(1);
  });
});
