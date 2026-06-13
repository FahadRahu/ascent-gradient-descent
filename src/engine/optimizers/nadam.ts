import type { GradFn, Optimizer, OptimizerState, StepResult, Vec2 } from '../types';

export interface NadamHyperparams {
  lr: number;
  beta1: number;
  beta2: number;
  eps: number;
}

// η=0.002 is the legacy-Keras Nadam default; modern Keras uses 0.001. We keep
// 0.002 paired with the constant-β₁ closed form for teaching (see plan notes).
export const NADAM_DEFAULTS: NadamHyperparams = { lr: 0.002, beta1: 0.9, beta2: 0.999, eps: 1e-8 };

/**
 * Nadam — Nesterov-accelerated Adam, constant-β₁ closed form (Ruder 2016):
 * m, v as in Adam; m̂=m/(1−β₁ᵗ), v̂=v/(1−β₂ᵗ);
 * θ = θ − (η/(√v̂ + ε))·(β₁·m̂ + (1−β₁)·g/(1−β₁ᵗ)).
 * The look-ahead lives in the numerator's blend of m̂ and the current g.
 * (Production Keras uses a momentum schedule; we use the cleaner closed form.)
 */
export function makeNadam(hp: NadamHyperparams = NADAM_DEFAULTS): Optimizer {
  return {
    id: 'nadam',
    name: 'Nadam',
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
      const numer = (i: number): number =>
        hp.beta1 * (m[i] / bc1) + ((1 - hp.beta1) * g[i]) / bc1;
      const next: Vec2 = [
        theta[0] - (hp.lr / (Math.sqrt(v[0] / bc2) + hp.eps)) * numer(0),
        theta[1] - (hp.lr / (Math.sqrt(v[1] / bc2) + hp.eps)) * numer(1),
      ];
      return {
        theta: next,
        state: { ...state, iteration: t, m, v },
        aux: { m, v, gradient: g },
      };
    },
  };
}
