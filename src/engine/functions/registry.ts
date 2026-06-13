import type { CostFunction, Vec2 } from '../types';
import { compileGradient } from '../autodiff';

/** Build a CostFunction whose cost+grad come from autodiff over `expr`. */
function fromExpr(
  meta: Omit<CostFunction, 'cost' | 'grad'>,
): CostFunction {
  const { f, grad } = compileGradient(meta.expr);
  return {
    ...meta,
    cost: (theta: Vec2) => f(theta[0], theta[1]),
    grad: (theta: Vec2) => grad(theta[0], theta[1]),
  };
}

// --- Ackley: hand-guarded gradient (autodiff yields NaN at the 0/0 cusp). ---
const ackleyExpr =
  '-20*exp(-0.2*sqrt(0.5*(x^2+y^2))) - exp(0.5*(cos(2*pi*x)+cos(2*pi*y))) + e + 20';

function ackleyCost(theta: Vec2): number {
  const [x, y] = theta;
  return (
    -20 * Math.exp(-0.2 * Math.sqrt(0.5 * (x * x + y * y))) -
    Math.exp(0.5 * (Math.cos(2 * Math.PI * x) + Math.cos(2 * Math.PI * y))) +
    Math.E +
    20
  );
}

function ackleyGrad(theta: Vec2): Vec2 {
  const [x, y] = theta;
  const r = Math.sqrt(0.5 * (x * x + y * y));
  const cosTerm = Math.exp(0.5 * (Math.cos(2 * Math.PI * x) + Math.cos(2 * Math.PI * y)));
  // At r=0 the sqrt term's derivative (0.5*x/r) is 0/0; the function has a cusp.
  // Guard: return a finite [0,0] (the cosine term's derivative is also 0 there
  // since sin(0)=0), so the descent loop never sees NaN (PRD §4.4 robustness).
  if (r === 0) return [0, 0];
  const gx = 4 * Math.exp(-0.2 * r) * (0.5 * x / r) + cosTerm * Math.PI * Math.sin(2 * Math.PI * x);
  const gy = 4 * Math.exp(-0.2 * r) * (0.5 * y / r) + cosTerm * Math.PI * Math.sin(2 * Math.PI * y);
  return [gx, gy];
}

export const FUNCTIONS: readonly CostFunction[] = [
  fromExpr({
    id: 'sphere',
    name: 'Sphere',
    expr: 'x^2 + y^2',
    minima: [[0, 0]],
    domain: [-5, 5, -5, 5],
    teaches: 'convex baseline',
  }),
  fromExpr({
    id: 'matyas',
    name: 'Matyas',
    expr: '0.26*(x^2 + y^2) - 0.48*x*y',
    minima: [[0, 0]],
    domain: [-10, 10, -10, 10],
    teaches: 'mild conditioning',
  }),
  fromExpr({
    id: 'booth',
    name: 'Booth',
    expr: '(x + 2*y - 7)^2 + (2*x + y - 5)^2',
    minima: [[1, 3]],
    domain: [-10, 10, -10, 10],
    teaches: 'clean convex',
  }),
  fromExpr({
    id: 'rosenbrock',
    name: 'Rosenbrock',
    expr: '(1 - x)^2 + 100*(y - x^2)^2',
    minima: [[1, 1]],
    domain: [-2, 2, -1, 3],
    teaches: 'narrow curved valley / zig-zag (headline)',
  }),
  fromExpr({
    id: 'beale',
    name: 'Beale',
    expr: '(1.5 - x + x*y)^2 + (2.25 - x + x*y^2)^2 + (2.625 - x + x*y^3)^2',
    minima: [[3, 0.5]],
    domain: [-4.5, 4.5, -4.5, 4.5],
    teaches: 'sharp ill-conditioning',
  }),
  fromExpr({
    id: 'saddle',
    name: 'Saddle',
    expr: 'x^2 - y^2',
    minima: [[0, 0]], // a saddle, not a minimum — see teaches
    domain: [-3, 3, -3, 3],
    teaches: 'momentum vs Adam behavior at saddles',
  }),
  fromExpr({
    id: 'himmelblau',
    name: 'Himmelblau',
    expr: '(x^2 + y - 11)^2 + (x + y^2 - 7)^2',
    minima: [[3, 2], [-2.805118, 3.131312], [-3.77931, -3.283186], [3.584428, -1.848127]],
    domain: [-5, 5, -5, 5],
    teaches: 'four minima — different starts reach different minima',
  }),
  fromExpr({
    id: 'rastrigin',
    name: 'Rastrigin',
    expr: '20 + x^2 + y^2 - 10*(cos(2*pi*x) + cos(2*pi*y))',
    minima: [[0, 0]],
    domain: [-5.12, 5.12, -5.12, 5.12],
    teaches: 'many local minima / escape story',
  }),
  {
    id: 'ackley',
    name: 'Ackley',
    expr: ackleyExpr,
    cost: ackleyCost,
    grad: ackleyGrad,
    minima: [[0, 0]],
    domain: [-5, 5, -5, 5],
    teaches: 'local minima + flat outer region',
    hasSingularity: true,
  },
];

const BY_ID = new Map(FUNCTIONS.map((f) => [f.id, f]));

export function getFunction(id: string): CostFunction {
  const f = BY_ID.get(id);
  if (!f) throw new Error(`Unknown cost function: ${id}`);
  return f;
}
