import { FUNCTIONS, getFunction } from './functions';
import type { CostFunction, Vec2 } from './types';

/** Central-difference gradient: (f(x+h) - f(x-h)) / 2h per axis. */
function centralDiff(fn: CostFunction, theta: Vec2, h = 1e-5): Vec2 {
  const [x, y] = theta;
  const dx = (fn.cost([x + h, y]) - fn.cost([x - h, y])) / (2 * h);
  const dy = (fn.cost([x, y + h]) - fn.cost([x, y - h])) / (2 * h);
  return [dx, dy];
}

/** Pass if absolute OR relative error is within tol (handles big gradients
 *  like Rosenbrock/Beale where absolute error scales with magnitude). */
function agrees(a: number, b: number, tol = 1e-6): boolean {
  const abs = Math.abs(a - b);
  if (abs <= tol) return true;
  const rel = abs / Math.max(Math.abs(a), Math.abs(b), 1e-12);
  return rel <= 1e-6;
}

// A spread of non-singular test points per function (avoid exact minima where
// the gradient is ~0 and finite-diff floating error dominates, and avoid the
// Ackley origin cusp).
const TEST_POINTS: Record<string, Vec2[]> = {
  sphere: [[1.5, -2], [3, 4], [-1, 0.5]],
  matyas: [[2, -1], [1, 3], [-2, -2]],
  booth: [[0, 0], [2, 1], [-3, 4]],
  rosenbrock: [[-1.2, 1], [0.5, 0.5], [2, 2], [-1, -1]],
  beale: [[1, 1], [-2, 0.5], [0, 0], [2, 0.3]],
  saddle: [[2, 3], [-1, 1], [0.5, -0.5]],
  himmelblau: [[0, 0], [1, 1], [-2, 2], [4, -2]],
  rastrigin: [[0.3, -0.4], [1.5, 2.5], [-0.7, 0.2]],
  ackley: [[0.5, 0.5], [1, -1], [2, 3], [-1.5, 0.8]], // origin excluded (cusp)
};

describe('gradient validation — autodiff vs central differences (~1e-6)', () => {
  for (const fn of FUNCTIONS) {
    const points = TEST_POINTS[fn.id];
    it(`${fn.name}: analytic gradient matches finite differences at all test points`, () => {
      for (const p of points) {
        const [ax, ay] = fn.grad(p);
        const [nx, ny] = centralDiff(fn, p);
        expect(agrees(ax, nx), `${fn.name} ∂x at (${p}): analytic ${ax} vs fd ${nx}`).toBe(true);
        expect(agrees(ay, ny), `${fn.name} ∂y at (${p}): analytic ${ay} vs fd ${ny}`).toBe(true);
      }
    });
  }

  it('Rosenbrock gradient is exactly [0,0] at the minimum (1,1) — PRD anchor', () => {
    const [gx, gy] = getFunction('rosenbrock').grad([1, 1]);
    expect(gx).toBeCloseTo(0, 8);
    expect(gy).toBeCloseTo(0, 8);
  });

  it('Ackley gradient is finite (guarded) at the origin cusp', () => {
    const [gx, gy] = getFunction('ackley').grad([0, 0]);
    expect(Number.isFinite(gx) && Number.isFinite(gy)).toBe(true);
  });
});
