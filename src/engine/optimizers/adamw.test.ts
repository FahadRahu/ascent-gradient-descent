import { makeAdamW } from './adamw';
import type { GradFn, Vec2 } from '../types';

const grad: GradFn = (t: Vec2) => [2 * t[0], 2 * t[1]];

describe('AdamW', () => {
  it('decoupled lr-scaled decay first θ-=η·λ·θ, then Adam (matches PyTorch): (1,1)→≈0.998990→≈0.997980', () => {
    const opt = makeAdamW({ lr: 0.001, beta1: 0.9, beta2: 0.999, eps: 1e-8, weightDecay: 1e-2 });
    let state = opt.init([1, 1]);
    let theta: Vec2 = [1, 1];
    ({ theta, state } = opt.step(theta, grad, state));
    expect(theta[0]).toBeCloseTo(0.998990000005, 9);
    ({ theta, state } = opt.step(theta, grad, state));
    expect(theta[0]).toBeCloseTo(0.9979800365772695, 9);
  });
});
