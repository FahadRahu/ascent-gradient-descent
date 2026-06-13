import type { GradFn, Optimizer, OptimizerState, StepResult, Vec2 } from '../types';

export interface AdamHyperparams {
  lr: number;
  beta1: number;
  beta2: number;
  eps: number;
}

export const ADAM_DEFAULTS: AdamHyperparams = { lr: 0.001, beta1: 0.9, beta2: 0.999, eps: 1e-8 };

/**
 * Adam: m=β₁m+(1−β₁)g; v=β₂v+(1−β₂)g²; bias-correct m̂=m/(1−β₁ᵗ), v̂=v/(1−β₂ᵗ);
 * θ = θ − η·m̂/(√v̂ + ε). eps is OUTSIDE the sqrt (Ruder/Keras convention). t
 * increments per step starting at 1.
 */
export function makeAdam(hp: AdamHyperparams = ADAM_DEFAULTS): Optimizer {
  return {
    id: 'adam',
    name: 'Adam',
    init: (): OptimizerState => ({ iteration: 0, m: [0, 0], v: [0, 0] }),
    step(theta: Vec2, grad: GradFn, state: OptimizerState): StepResult {
      const g = grad(theta);
      const t = state.iteration + 1;
      const m0 = state.m ?? [0, 0];
      const v0 = state.v ?? [0, 0];
      const m: [number, number] = [
        hp.beta1 * m0[0] + (1 - hp.beta1) * g[0],
        hp.beta1 * m0[1] + (1 - hp.beta1) * g[1],
      ];
      const v: [number, number] = [
        hp.beta2 * v0[0] + (1 - hp.beta2) * g[0] * g[0],
        hp.beta2 * v0[1] + (1 - hp.beta2) * g[1] * g[1],
      ];
      const bc1 = 1 - Math.pow(hp.beta1, t);
      const bc2 = 1 - Math.pow(hp.beta2, t);
      const next: Vec2 = [
        theta[0] - (hp.lr * (m[0] / bc1)) / (Math.sqrt(v[0] / bc2) + hp.eps),
        theta[1] - (hp.lr * (m[1] / bc1)) / (Math.sqrt(v[1] / bc2) + hp.eps),
      ];
      return {
        theta: next,
        state: { ...state, iteration: t, m, v },
        aux: { m, v, gradient: g },
      };
    },
  };
}
