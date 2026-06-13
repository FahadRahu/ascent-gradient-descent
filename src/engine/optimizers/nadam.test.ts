import { makeNadam } from './nadam';
import type { GradFn, Vec2 } from '../types';

const grad: GradFn = (t: Vec2) => [2 * t[0], 2 * t[1]];

describe('Nadam (constant-β₁ closed form, after Ruder)', () => {
  it('Nesterov look-ahead numerator (η=0.002): (1,1)→≈0.996200→≈0.993350', () => {
    const opt = makeNadam({ lr: 0.002, beta1: 0.9, beta2: 0.999, eps: 1e-8 });
    let state = opt.init([1, 1]);
    let theta: Vec2 = [1, 1];
    ({ theta, state } = opt.step(theta, grad, state));
    expect(theta[0]).toBeCloseTo(0.996200000019, 9);
    ({ theta, state } = opt.step(theta, grad, state));
    expect(theta[0]).toBeCloseTo(0.9933495550544302, 9);
  });
});
