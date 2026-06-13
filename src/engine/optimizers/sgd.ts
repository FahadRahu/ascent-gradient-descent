import type { GradFn, Optimizer, OptimizerState, StepResult, Vec2 } from '../types';

export interface SGDHyperparams {
  lr: number;
}

export const SGD_DEFAULTS: SGDHyperparams = { lr: 0.1 };

/** Stochastic gradient descent: θ = θ − η·g. Stateless beyond the iteration count. */
export function makeSGD(hp: SGDHyperparams = SGD_DEFAULTS): Optimizer {
  return {
    id: 'sgd',
    name: 'SGD',
    init: (): OptimizerState => ({ iteration: 0 }),
    step(theta: Vec2, grad: GradFn, state: OptimizerState): StepResult {
      const g = grad(theta);
      const next: Vec2 = [theta[0] - hp.lr * g[0], theta[1] - hp.lr * g[1]];
      return {
        theta: next,
        state: { ...state, iteration: state.iteration + 1 },
        aux: { gradient: g },
      };
    },
  };
}
