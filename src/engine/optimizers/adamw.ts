import type { GradFn, Optimizer, OptimizerState, StepResult, Vec2 } from '../types';

export interface AdamWHyperparams {
  lr: number;
  beta1: number;
  beta2: number;
  eps: number;
  weightDecay: number;
}

export const ADAMW_DEFAULTS: AdamWHyperparams = {
  lr: 0.001,
  beta1: 0.9,
  beta2: 0.999,
  eps: 1e-8,
  weightDecay: 1e-2,
};

/**
 * AdamW (Loshchilov & Hutter): decoupled weight decay applied to θ FIRST and
 * scaled by the learning rate — θ = θ − η·λ·θ — then the standard Adam update.
 * The decay is NEVER folded into the gradient g (that would be L2 / Adam+L2,
 * the variant the paper argues against). Matches PyTorch's AdamW exactly.
 */
export function makeAdamW(hp: AdamWHyperparams = ADAMW_DEFAULTS): Optimizer {
  return {
    id: 'adamw',
    name: 'AdamW',
    init: (): OptimizerState => ({ iteration: 0, m: [0, 0], v: [0, 0] }),
    step(theta: Vec2, grad: GradFn, state: OptimizerState): StepResult {
      const g = grad(theta); // gradient of the loss ONLY
      const t = state.iteration + 1;
      // 1) Decoupled, lr-scaled weight decay applied directly to θ.
      const decayed: Vec2 = [
        theta[0] - hp.lr * hp.weightDecay * theta[0],
        theta[1] - hp.lr * hp.weightDecay * theta[1],
      ];
      // 2) Standard Adam moment update (decay does NOT enter m/v).
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
      const mHat: Vec2 = [m[0] / bc1, m[1] / bc1];
      const vHat: Vec2 = [v[0] / bc2, v[1] / bc2];
      const next: Vec2 = [
        decayed[0] - (hp.lr * mHat[0]) / (Math.sqrt(vHat[0]) + hp.eps),
        decayed[1] - (hp.lr * mHat[1]) / (Math.sqrt(vHat[1]) + hp.eps),
      ];
      return {
        theta: next,
        state: { ...state, iteration: t, m, v },
        aux: { mHat, vHat, gradient: g },
      };
    },
  };
}
