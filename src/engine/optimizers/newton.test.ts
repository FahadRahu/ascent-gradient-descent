import { makeNewton } from './newton';
import type { GradFn, HessFn, Vec2 } from '../types';

const grad: GradFn = (t: Vec2) => [2 * t[0], 2 * t[1]];
const hess: HessFn = () => [[2, 0], [0, 2]]; // constant Hessian of x^2+y^2

describe('Newton (2nd-order, LM-damped)', () => {
  it('reaches the minimum in ~1 step on a quadratic (μ=1e-6): (1,1)→≈5e-7', () => {
    const opt = makeNewton({ mu: 1e-6 }, hess);
    let state = opt.init([1, 1]);
    let theta: Vec2 = [1, 1];
    ({ theta, state } = opt.step(theta, grad, state));
    expect(theta[0]).toBeCloseTo(4.999997500476638e-7, 12);
    ({ theta, state } = opt.step(theta, grad, state));
    expect(theta[0]).toBeCloseTo(2.4999975007924193e-13, 18);
  });

  it('solves the 2×2 system with off-diagonal Hessian terms', () => {
    // H=[[4,1],[1,3]], g=[1,2], μ=0: solve (H)·d = g, θ' = θ - d.
    const H: HessFn = () => [[4, 1], [1, 3]];
    const g: GradFn = () => [1, 2];
    const opt = makeNewton({ mu: 0 }, H);
    const { theta } = opt.step([0, 0], g, opt.init([0, 0]));
    // det=11; d = (1/11)[[3,-1],[-1,4]]·[1,2] = (1/11)[1, 7] = [0.0909..,0.6363..]
    expect(theta[0]).toBeCloseTo(-1 / 11, 10);
    expect(theta[1]).toBeCloseTo(-7 / 11, 10);
  });
});
