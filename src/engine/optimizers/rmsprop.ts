import type { GradFn, Optimizer, OptimizerState, StepResult, Vec2 } from '../types';

export interface RMSPropHyperparams {
  lr: number;
  eps: number;
  decay: number;
}

export const RMSPROP_DEFAULTS: RMSPropHyperparams = { lr: 0.001, eps: 1e-8, decay: 0.9 };

/** RMSProp: E = ρE + (1−ρ)g²; θ = θ − η/√(E+ε)·g (ρ=0.9 → 0.9E + 0.1g²). */
export function makeRMSProp(hp: RMSPropHyperparams = RMSPROP_DEFAULTS): Optimizer {
  return {
    id: 'rmsprop',
    name: 'RMSProp',
    init: (): OptimizerState => ({ iteration: 0, E: [0, 0] }),
    step(theta: Vec2, grad: GradFn, state: OptimizerState): StepResult {
      const g = grad(theta);
      const E0 = state.E ?? [0, 0];
      const E: [number, number] = [
        hp.decay * E0[0] + (1 - hp.decay) * g[0] * g[0],
        hp.decay * E0[1] + (1 - hp.decay) * g[1] * g[1],
      ];
      const scale: [number, number] = [
        hp.lr / Math.sqrt(E[0] + hp.eps),
        hp.lr / Math.sqrt(E[1] + hp.eps),
      ];
      const next: Vec2 = [theta[0] - scale[0] * g[0], theta[1] - scale[1] * g[1]];
      return {
        theta: next,
        state: { ...state, iteration: state.iteration + 1, E },
        aux: { accumulator: E, scaling: scale, gradient: g },
      };
    },
  };
}
