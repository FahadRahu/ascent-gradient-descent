import type { GradFn, Optimizer, OptimizerState, StepResult, Vec2 } from '../types';

export interface AdaGradHyperparams {
  lr: number;
  eps: number;
}

export const ADAGRAD_DEFAULTS: AdaGradHyperparams = { lr: 0.01, eps: 1e-8 };

/** AdaGrad: G += g²; θ = θ − η/√(G+ε)·g. G grows monotonically (stalls late). */
export function makeAdaGrad(hp: AdaGradHyperparams = ADAGRAD_DEFAULTS): Optimizer {
  return {
    id: 'adagrad',
    name: 'AdaGrad',
    init: (): OptimizerState => ({ iteration: 0, G: [0, 0] }),
    step(theta: Vec2, grad: GradFn, state: OptimizerState): StepResult {
      const g = grad(theta);
      const G0 = state.G ?? [0, 0];
      const G: [number, number] = [G0[0] + g[0] * g[0], G0[1] + g[1] * g[1]];
      const scale: [number, number] = [
        hp.lr / Math.sqrt(G[0] + hp.eps),
        hp.lr / Math.sqrt(G[1] + hp.eps),
      ];
      const next: Vec2 = [theta[0] - scale[0] * g[0], theta[1] - scale[1] * g[1]];
      return {
        theta: next,
        state: { ...state, iteration: state.iteration + 1, G },
        aux: { accumulator: G, scaling: scale, gradient: g },
      };
    },
  };
}
