import type { GradFn, HessFn, Optimizer, OptimizerId, Vec2 } from '../types';
import { makeSGD, SGD_DEFAULTS } from './sgd';
import { makeMomentum, MOMENTUM_DEFAULTS } from './momentum';
import { makeNesterov, NESTEROV_DEFAULTS } from './nesterov';
import { makeAdaGrad, ADAGRAD_DEFAULTS } from './adagrad';
import { makeRMSProp, RMSPROP_DEFAULTS } from './rmsprop';
import { makeAdam, ADAM_DEFAULTS } from './adam';
import { makeAdamW, ADAMW_DEFAULTS } from './adamw';
import { makeNadam, NADAM_DEFAULTS } from './nadam';
import { makeNewton, NEWTON_DEFAULTS } from './newton';

export const OPTIMIZER_IDS: readonly OptimizerId[] = [
  'sgd', 'momentum', 'nesterov', 'adagrad', 'rmsprop', 'adam', 'adamw', 'nadam', 'newton',
];

/** Default hyperparameters per optimizer (single source of truth for the UI). */
export const OPTIMIZER_DEFAULTS = {
  sgd: SGD_DEFAULTS,
  momentum: MOMENTUM_DEFAULTS,
  nesterov: NESTEROV_DEFAULTS,
  adagrad: ADAGRAD_DEFAULTS,
  rmsprop: RMSPROP_DEFAULTS,
  adam: ADAM_DEFAULTS,
  adamw: ADAMW_DEFAULTS,
  nadam: NADAM_DEFAULTS,
  newton: NEWTON_DEFAULTS,
} as const;

/**
 * Build a numeric Hessian function from a gradient function via central
 * differences (for Newton when no analytic Hessian is supplied). H_ij = ∂g_i/∂x_j.
 */
export function numericHessian(grad: GradFn, h = 1e-4): HessFn {
  return (theta: Vec2) => {
    const [x, y] = theta;
    const gxp = grad([x + h, y]);
    const gxm = grad([x - h, y]);
    const gyp = grad([x, y + h]);
    const gym = grad([x, y - h]);
    const fxx = (gxp[0] - gxm[0]) / (2 * h);
    const fyx = (gxp[1] - gxm[1]) / (2 * h);
    const fxy = (gyp[0] - gym[0]) / (2 * h);
    const fyy = (gyp[1] - gym[1]) / (2 * h);
    // Symmetrize the off-diagonal to reduce numeric asymmetry.
    const off = (fxy + fyx) / 2;
    return [[fxx, off], [off, fyy]];
  };
}

/**
 * Build an optimizer by id. Newton needs a Hessian; if none is given, a numeric
 * one is derived from `grad` (which must then be supplied). Hyperparameters are
 * the defaults merged with any overrides.
 */
export function makeOptimizer(
  id: OptimizerId,
  overrides: Record<string, number> = {},
  opts: { grad?: GradFn; hess?: HessFn } = {},
): Optimizer {
  switch (id) {
    case 'sgd':
      return makeSGD({ ...SGD_DEFAULTS, ...overrides });
    case 'momentum':
      return makeMomentum({ ...MOMENTUM_DEFAULTS, ...overrides });
    case 'nesterov':
      return makeNesterov({ ...NESTEROV_DEFAULTS, ...overrides });
    case 'adagrad':
      return makeAdaGrad({ ...ADAGRAD_DEFAULTS, ...overrides });
    case 'rmsprop':
      return makeRMSProp({ ...RMSPROP_DEFAULTS, ...overrides });
    case 'adam':
      return makeAdam({ ...ADAM_DEFAULTS, ...overrides });
    case 'adamw':
      return makeAdamW({ ...ADAMW_DEFAULTS, ...overrides });
    case 'nadam':
      return makeNadam({ ...NADAM_DEFAULTS, ...overrides });
    case 'newton': {
      const hess = opts.hess ?? (opts.grad ? numericHessian(opts.grad) : undefined);
      return makeNewton({ ...NEWTON_DEFAULTS, ...overrides }, hess);
    }
    default: {
      const _exhaustive: never = id;
      throw new Error(`Unknown optimizer id: ${_exhaustive}`);
    }
  }
}
