/** A point or vector in the 2-parameter (x, y) space. */
export type Vec2 = readonly [number, number];

/** Gradient of the cost at an arbitrary point — passed to optimizers so that
 *  Nesterov can evaluate at a look-ahead point and others at the current one. */
export type GradFn = (theta: Vec2) => Vec2;

/** Cost value at an arbitrary point (needed by Nesterov bookkeeping & UI). */
export type CostFn = (theta: Vec2) => number;

/** Hessian at a point as a 2×2 matrix [[fxx, fxy], [fyx, fyy]] — Newton only. */
export type Hessian = readonly [readonly [number, number], readonly [number, number]];
export type HessFn = (theta: Vec2) => Hessian;

/** A curated or user-supplied cost function. */
export interface CostFunction {
  readonly id: string;
  readonly name: string;
  /** LaTeX-free human formula, e.g. "x^2 + y^2" (KaTeX rendering is M3). */
  readonly expr: string;
  readonly cost: CostFn;
  readonly grad: GradFn;
  /** Known global minimum/minima (for tests, beacons, "converged" checks). */
  readonly minima: readonly Vec2[];
  /** Suggested domain for surface sampling [xMin, xMax, yMin, yMax]. */
  readonly domain: readonly [number, number, number, number];
  /** One-line teaching role from PRD §4.3. */
  readonly teaches: string;
  /** True if the analytic gradient has a singular point (e.g. Ackley origin). */
  readonly hasSingularity?: boolean;
}

export type OptimizerId =
  | 'sgd'
  | 'momentum'
  | 'nesterov'
  | 'adagrad'
  | 'rmsprop'
  | 'adam'
  | 'adamw'
  | 'nadam'
  | 'newton';

/** Per-optimizer mutable state (velocity, moment buffers, accumulators, t). */
export interface OptimizerState {
  iteration: number;
  // Slots used by subsets of optimizers; undefined until init.
  velocity?: [number, number];      // Momentum, Nesterov
  G?: [number, number];             // AdaGrad (sum of squared grads)
  E?: [number, number];             // RMSProp (decayed avg of squared grads)
  m?: [number, number];             // Adam/AdamW/Nadam (1st moment)
  v?: [number, number];             // Adam/AdamW/Nadam (2nd moment)
}

/** Result of one optimizer step: new point, advanced state, and optional
 *  internal-state values for the M2 visualization (velocity arrow, per-axis
 *  adaptive scaling, bias-corrected moments). */
export interface StepResult {
  theta: Vec2;
  state: OptimizerState;
  aux?: Record<string, Vec2 | number>;
}

/** Uniform optimizer interface. Every optimizer takes a GradFn (not a
 *  precomputed gradient) so Nesterov's look-ahead and Newton's needs fit the
 *  same signature; first-order methods simply call grad(theta) once. */
export interface Optimizer {
  readonly id: OptimizerId;
  readonly name: string;
  /** Fresh zeroed state for a run starting at theta0. */
  init(theta0: Vec2): OptimizerState;
  /** Advance one step. Pure w.r.t. inputs: returns new theta + new state. */
  step(theta: Vec2, grad: GradFn, state: OptimizerState): StepResult;
}

/** Optional capabilities an optimizer may need beyond a GradFn. */
export interface OptimizerContext {
  /** Hessian provider — required only by Newton. */
  hess?: HessFn;
}
