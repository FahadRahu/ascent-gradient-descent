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

  it('aux exposes bias-corrected moments m̂, v̂ and the gradient', () => {
    const opt = makeNadam({ lr: 0.002, beta1: 0.9, beta2: 0.999, eps: 1e-8 });
    const state = opt.init([1, 1]);
    const r1 = opt.step([1, 1], grad, state);
    const mHat1 = r1.aux!.mHat as unknown as Vec2;
    const vHat1 = r1.aux!.vHat as unknown as Vec2;
    expect(mHat1[0]).toBeCloseTo(2, 12);
    expect(vHat1[0]).toBeCloseTo(4, 12);
    const r2 = opt.step(r1.theta, grad, r1.state);
    const mHat2 = r2.aux!.mHat as unknown as Vec2;
    const vHat2 = r2.aux!.vHat as unknown as Vec2;
    expect(mHat2[0]).toBeCloseTo(1.9960000000200002, 12);
    expect(vHat2[0]).toBeCloseTo(3.9848212907211287, 12);
  });
});
