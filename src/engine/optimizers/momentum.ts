import type { GradFn, Optimizer, OptimizerState, StepResult, Vec2 } from '../types';

export interface MomentumHyperparams {
  lr: number;
  gamma: number;
}

export const MOMENTUM_DEFAULTS: MomentumHyperparams = { lr: 0.1, gamma: 0.9 };

/** Classical momentum: v = γv + ηg; θ = θ − v. */
export function makeMomentum(hp: MomentumHyperparams = MOMENTUM_DEFAULTS): Optimizer {
  return {
    id: 'momentum',
    name: 'Momentum',
    init: (): OptimizerState => ({ iteration: 0, velocity: [0, 0] }),
    step(theta: Vec2, grad: GradFn, state: OptimizerState): StepResult {
      const g = grad(theta);
      const v0 = state.velocity ?? [0, 0];
      const v: [number, number] = [
        hp.gamma * v0[0] + hp.lr * g[0],
        hp.gamma * v0[1] + hp.lr * g[1],
      ];
      const next: Vec2 = [theta[0] - v[0], theta[1] - v[1]];
      return {
        theta: next,
        state: { ...state, iteration: state.iteration + 1, velocity: v },
        aux: { velocity: v, gradient: g },
      };
    },
  };
}
