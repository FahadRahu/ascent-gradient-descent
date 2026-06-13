import { makeAdaGrad } from './adagrad';
import type { GradFn, Vec2 } from '../types';

const grad: GradFn = (t: Vec2) => [2 * t[0], 2 * t[1]];

describe('AdaGrad', () => {
  it('G+=g²; θ-=η/√(G+ε)·g (η=0.01): (1,1)→≈0.99→≈0.98296', () => {
    const opt = makeAdaGrad({ lr: 0.01, eps: 1e-8 });
    let state = opt.init([1, 1]);
    let theta: Vec2 = [1, 1];
    ({ theta, state } = opt.step(theta, grad, state));
    expect(theta[0]).toBeCloseTo(0.9900000000125, 9);
    ({ theta, state } = opt.step(theta, grad, state));
    expect(theta[0]).toBeCloseTo(0.9829645540376954, 9);
  });
});
