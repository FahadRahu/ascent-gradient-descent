import { FUNCTIONS, getFunction } from './registry';

describe('cost-function registry', () => {
  it('registers all 9 curated functions', () => {
    expect(FUNCTIONS.map((f) => f.id).sort()).toEqual(
      ['ackley', 'beale', 'booth', 'himmelblau', 'matyas', 'rastrigin', 'rosenbrock', 'saddle', 'sphere'],
    );
  });

  it('getFunction looks up by id and throws on unknown', () => {
    expect(getFunction('rosenbrock').name).toBe('Rosenbrock');
    expect(() => getFunction('nope')).toThrow();
  });

  // --- Values at minima (execution-verified) ---
  it('Sphere: f=0 and grad=[0,0] at (0,0)', () => {
    const f = getFunction('sphere');
    expect(f.cost([0, 0])).toBe(0);
    expect(f.grad([0, 0])).toEqual([0, 0]);
  });

  it('Booth: f=0 at (1,3); f=74, grad=[-34,-38] at (0,0)', () => {
    const f = getFunction('booth');
    expect(f.cost([1, 3])).toBeCloseTo(0, 10);
    expect(f.cost([0, 0])).toBeCloseTo(74, 10);
    const [gx, gy] = f.grad([0, 0]);
    expect(gx).toBeCloseTo(-34, 10);
    expect(gy).toBeCloseTo(-38, 10);
  });

  it('Rosenbrock ANCHOR: grad=[0,0] at (1,1); grad=[-215.6,-88] at (-1.2,1)', () => {
    const f = getFunction('rosenbrock');
    const [gx, gy] = f.grad([1, 1]);
    expect(gx).toBeCloseTo(0, 8);
    expect(gy).toBeCloseTo(0, 8);
    const [hx, hy] = f.grad([-1.2, 1]);
    expect(hx).toBeCloseTo(-215.6, 6);
    expect(hy).toBeCloseTo(-88, 6);
  });

  it('Beale: f=0 at (3,0.5); grad=[0,27.75] at (1,1)', () => {
    const f = getFunction('beale');
    expect(f.cost([3, 0.5])).toBeCloseTo(0, 8);
    const [gx, gy] = f.grad([1, 1]);
    expect(gx).toBeCloseTo(0, 8);
    expect(gy).toBeCloseTo(27.75, 8);
  });

  it('Himmelblau: f=0 at all four minima', () => {
    const f = getFunction('himmelblau');
    for (const m of [[3, 2], [-2.805118, 3.131312], [-3.779310, -3.283186], [3.584428, -1.848127]] as const) {
      expect(f.cost(m)).toBeLessThan(1e-3);
    }
  });

  it('Matyas: grad=[1.52,-1.48] at (2,-1)', () => {
    const [gx, gy] = getFunction('matyas').grad([2, -1]);
    expect(gx).toBeCloseTo(1.52, 10);
    expect(gy).toBeCloseTo(-1.48, 10);
  });

  it('Saddle: grad=[0,0] at (0,0) but it is a saddle, not a min', () => {
    const f = getFunction('saddle');
    expect(f.grad([0, 0])).toEqual([0, 0]);
    expect(f.cost([0, 1])).toBeLessThan(f.cost([0, 0])); // descends in y
  });

  it('Rastrigin: f=0 at (0,0); grad≈[60.357,-37.732] at (0.3,-0.4)', () => {
    const f = getFunction('rastrigin');
    expect(f.cost([0, 0])).toBeCloseTo(0, 10);
    const [gx, gy] = f.grad([0.3, -0.4]);
    expect(gx).toBeCloseTo(60.35664329483112, 6);
    expect(gy).toBeCloseTo(-37.73163660980914, 6);
  });

  it('Ackley: f≈0 at origin; gradient GUARDED to [0,0] there (cusp), not NaN', () => {
    const f = getFunction('ackley');
    expect(f.cost([0, 0])).toBeCloseTo(0, 10);
    const [gx, gy] = f.grad([0, 0]);
    expect(Number.isFinite(gx)).toBe(true);
    expect(Number.isFinite(gy)).toBe(true);
    expect(gx).toBe(0);
    expect(gy).toBe(0);
  });

  it('Ackley: gradient is correct at a non-singular point (0.5,0.5)≈1.80967', () => {
    const [gx, gy] = getFunction('ackley').grad([0.5, 0.5]);
    expect(gx).toBeCloseTo(1.8096748360719193, 6);
    expect(gy).toBeCloseTo(1.8096748360719193, 6);
  });
});
