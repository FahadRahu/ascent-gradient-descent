import type { GradFn, Optimizer, OptimizerState, StepResult, Vec2 } from '../types';

export interface NesterovHyperparams {
  lr: number;
  gamma: number;
}

export const NESTEROV_DEFAULTS: NesterovHyperparams = { lr: 0.1, gamma: 0.9 };

/**
 * Nesterov accelerated gradient: evaluate the gradient at the look-ahead point
 * θ − γv (the "prescient" step), then v = γv + η·∇f(θ−γv); θ = θ − v.
 * This is the canonical look-ahead form (Ruder), enabled by taking a GradFn.
 */
export function makeNesterov(hp: NesterovHyperparams = NESTEROV_DEFAULTS): Optimizer {
  return {
    id: 'nesterov',
    name: 'Nesterov',
    init: (): OptimizerState => ({ iteration: 0, velocity: [0, 0] }),
    step(theta: Vec2, grad: GradFn, state: OptimizerState): StepResult {
      const v0 = state.velocity ?? [0, 0];
      const lookahead: Vec2 = [theta[0] - hp.gamma * v0[0], theta[1] - hp.gamma * v0[1]];
      const g = grad(lookahead);
      const v: [number, number] = [
        hp.gamma * v0[0] + hp.lr * g[0],
        hp.gamma * v0[1] + hp.lr * g[1],
      ];
      const next: Vec2 = [theta[0] - v[0], theta[1] - v[1]];
      return {
        theta: next,
        state: { ...state, iteration: state.iteration + 1, velocity: v },
        aux: { velocity: v, lookahead, gradient: g },
      };
    },
  };
}
