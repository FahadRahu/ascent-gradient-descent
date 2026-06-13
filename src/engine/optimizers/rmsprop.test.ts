import { makeRMSProp } from './rmsprop';
import type { GradFn, Vec2 } from '../types';

const grad: GradFn = (t: Vec2) => [2 * t[0], 2 * t[1]];

describe('RMSProp', () => {
  it('E=0.9E+0.1g²; θ-=η/√(E+ε)·g (η=0.001): (1,1)→≈0.996838→≈0.994547', () => {
    const opt = makeRMSProp({ lr: 0.001, eps: 1e-8, decay: 0.9 });
    let state = opt.init([1, 1]);
    let theta: Vec2 = [1, 1];
    ({ theta, state } = opt.step(theta, grad, state));
    expect(theta[0]).toBeCloseTo(0.9968377223793601, 9);
    ({ theta, state } = opt.step(theta, grad, state));
    expect(theta[0]).toBeCloseTo(0.9945470101162064, 9);
  });
});
