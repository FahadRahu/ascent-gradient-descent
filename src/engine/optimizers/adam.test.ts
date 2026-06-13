import { makeAdam } from './adam';
import type { GradFn, Vec2 } from '../types';

const grad: GradFn = (t: Vec2) => [2 * t[0], 2 * t[1]];

describe('Adam', () => {
  it('bias-corrected moments (η=0.001): (1,1)→≈0.999000→≈0.998000', () => {
    const opt = makeAdam({ lr: 0.001, beta1: 0.9, beta2: 0.999, eps: 1e-8 });
    let state = opt.init([1, 1]);
    let theta: Vec2 = [1, 1];
    ({ theta, state } = opt.step(theta, grad, state));
    expect(theta[0]).toBeCloseTo(0.999000000005, 9);
    ({ theta, state } = opt.step(theta, grad, state));
    expect(theta[0]).toBeCloseTo(0.9980000262138343, 9);
  });
});
