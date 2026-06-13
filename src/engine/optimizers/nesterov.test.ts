import { makeNesterov } from './nesterov';
import type { GradFn, Vec2 } from '../types';

const grad: GradFn = (t: Vec2) => [2 * t[0], 2 * t[1]];

describe('Nesterov (NAG)', () => {
  it('look-ahead gradient at θ-γv (γ=0.9,η=0.1): (1,1)→(0.8,0.8)→(0.496,0.496)', () => {
    const opt = makeNesterov({ lr: 0.1, gamma: 0.9 });
    let state = opt.init([1, 1]);
    let theta: Vec2 = [1, 1];
    ({ theta, state } = opt.step(theta, grad, state));
    expect(theta[0]).toBeCloseTo(0.8, 12); // v0=0 → first step equals SGD
    ({ theta, state } = opt.step(theta, grad, state));
    expect(theta[0]).toBeCloseTo(0.496, 12);
    expect(theta[1]).toBeCloseTo(0.496, 12);
  });
});
