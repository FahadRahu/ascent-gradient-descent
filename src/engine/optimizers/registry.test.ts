import { OPTIMIZER_IDS, makeOptimizer, OPTIMIZER_DEFAULTS, numericHessian } from './registry';
import type { GradFn, Vec2 } from '../types';

const grad: GradFn = (t: Vec2) => [2 * t[0], 2 * t[1]];

describe('optimizer registry', () => {
  it('lists all 9 optimizer ids', () => {
    expect([...OPTIMIZER_IDS].sort()).toEqual(
      ['adagrad', 'adam', 'adamw', 'momentum', 'nadam', 'nesterov', 'newton', 'rmsprop', 'sgd'],
    );
  });

  it('makeOptimizer builds each by id with defaults', () => {
    for (const id of OPTIMIZER_IDS) {
      const opt = id === 'newton' ? makeOptimizer(id, {}, { grad }) : makeOptimizer(id);
      expect(opt.id).toBe(id);
      const state = opt.init([1, 1]);
      const { theta } = opt.step([1, 1], grad, state);
      expect(theta.every(Number.isFinite)).toBe(true);
    }
  });

  it('SGD via registry steps (1,1)→(0.8,0.8)', () => {
    const opt = makeOptimizer('sgd');
    const { theta } = opt.step([1, 1], grad, opt.init([1, 1]));
    expect(theta[0]).toBeCloseTo(0.8, 12);
  });

  it('numericHessian approximates the Hessian of x^2+y^2 as [[2,0],[0,2]]', () => {
    const H = numericHessian(grad)([1, 1]);
    expect(H[0][0]).toBeCloseTo(2, 4);
    expect(H[1][1]).toBeCloseTo(2, 4);
    expect(H[0][1]).toBeCloseTo(0, 4);
  });

  it('every default hyperparam set includes the expected learning rate', () => {
    expect(OPTIMIZER_DEFAULTS.sgd.lr).toBe(0.1);
    expect(OPTIMIZER_DEFAULTS.adam.lr).toBe(0.001);
    expect(OPTIMIZER_DEFAULTS.nadam.lr).toBe(0.002);
    expect(OPTIMIZER_DEFAULTS.adamw.weightDecay).toBe(1e-2);
  });
});
