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

  it('aux exposes bias-corrected moments m̂, v̂ and the gradient', () => {
    const opt = makeAdam({ lr: 0.001, beta1: 0.9, beta2: 0.999, eps: 1e-8 });
    const state = opt.init([1, 1]);
    // Step 1 from (1,1): g=[2,2]; m̂=g=[2,2], v̂=g²=[4,4] (bias correction divides by 1−β at t=1).
    const r1 = opt.step([1, 1], grad, state);
    const mHat1 = r1.aux!.mHat as unknown as Vec2;
    const vHat1 = r1.aux!.vHat as unknown as Vec2;
    const gradient1 = r1.aux!.gradient as unknown as Vec2;
    expect(mHat1[0]).toBeCloseTo(2, 12);
    expect(vHat1[0]).toBeCloseTo(4, 12);
    expect(gradient1[0]).toBeCloseTo(2, 12);
    // Step 2 from the advanced point.
    const r2 = opt.step(r1.theta, grad, r1.state);
    const mHat2 = r2.aux!.mHat as unknown as Vec2;
    const vHat2 = r2.aux!.vHat as unknown as Vec2;
    expect(mHat2[0]).toBeCloseTo(1.9989473684263157, 12);
    expect(vHat2[0]).toBeCloseTo(3.996000000020048, 12);
  });
});
