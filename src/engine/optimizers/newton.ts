import type { GradFn, HessFn, Optimizer, OptimizerState, StepResult, Vec2 } from '../types';

export interface NewtonHyperparams {
  /** Levenberg–Marquardt damping added to the Hessian diagonal (H + μI). */
  mu: number;
}

export const NEWTON_DEFAULTS: NewtonHyperparams = { mu: 1e-6 };

/**
 * Newton's method: θ = θ − (H + μI)⁻¹ g, with a closed-form 2×2 inverse and
 * Levenberg–Marquardt damping μ to survive indefinite/singular Hessians.
 * The Hessian provider is closed over at construction so step() keeps the
 * uniform (theta, grad, state) signature. Newton legitimately diverges and
 * seeks saddles on non-convex landscapes — surfaced as a teaching point (M2).
 */
export function makeNewton(hp: NewtonHyperparams = NEWTON_DEFAULTS, hess?: HessFn): Optimizer {
  if (!hess) throw new Error('Newton requires a Hessian function (HessFn)');
  return {
    id: 'newton',
    name: 'Newton',
    init: (): OptimizerState => ({ iteration: 0 }),
    step(theta: Vec2, grad: GradFn, state: OptimizerState): StepResult {
      const g = grad(theta);
      const H = hess(theta);
      // Damped Hessian (H + μI).
      const a = H[0][0] + hp.mu;
      const b = H[0][1];
      const c = H[1][0];
      const d = H[1][1] + hp.mu;
      const det = a * d - b * c;
      // Closed-form 2×2 inverse times g → Newton direction.
      // d_vec = (1/det) [[d,-b],[-c,a]] · g
      const dx = (d * g[0] - b * g[1]) / det;
      const dy = (-c * g[0] + a * g[1]) / det;
      const next: Vec2 = [theta[0] - dx, theta[1] - dy];
      return {
        theta: next,
        state: { ...state, iteration: state.iteration + 1 },
        aux: { gradient: g, det },
      };
    },
  };
}
