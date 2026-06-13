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

  it('aux exposes bias-corrected moments m̂, v̂ (decay does NOT enter m/v)', () => {
    const opt = makeAdamW({ lr: 0.001, beta1: 0.9, beta2: 0.999, eps: 1e-8, weightDecay: 1e-2 });
    const state = opt.init([1, 1]);
    const r1 = opt.step([1, 1], grad, state);
    const mHat1 = r1.aux!.mHat as unknown as Vec2;
    const vHat1 = r1.aux!.vHat as unknown as Vec2;
    expect(mHat1[0]).toBeCloseTo(2, 12);
    expect(vHat1[0]).toBeCloseTo(4, 12);
    const gradient1 = r1.aux!.gradient as unknown as Vec2;
    expect(gradient1[0]).toBeCloseTo(2, 12);
    const r2 = opt.step(r1.theta, grad, r1.state);
    const mHat2 = r2.aux!.mHat as unknown as Vec2;
    const vHat2 = r2.aux!.vHat as unknown as Vec2;
    expect(mHat2[0]).toBeCloseTo(1.9989368421105267, 12);
    expect(vHat2[0]).toBeCloseTo(3.995960020230153, 12);
  });
});
