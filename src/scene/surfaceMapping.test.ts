import {
  SURFACE_SIZE,
  paramToWorldXZ,
  worldXZToParam,
  vScaleFor,
  costToWorldHeight,
} from './surfaceMapping';
import { getFunction } from '../engine/functions';
import type { Vec2 } from '../engine/types';

describe('surfaceMapping — param↔world single source of truth', () => {
  const ros = getFunction('rosenbrock').domain; // [-2, 2, -1, 3]
  const sphere = getFunction('sphere').domain; // [-5, 5, -5, 5]

  it('SURFACE_SIZE is the locked 4 world units', () => {
    expect(SURFACE_SIZE).toBe(4);
  });

  it('maps the domain min-corner to (-SIZE/2, -SIZE/2)', () => {
    const [wx, wz] = paramToWorldXZ(ros[0], ros[2], ros);
    expect(wx).toBeCloseTo(-SURFACE_SIZE / 2, 12); // -2
    expect(wz).toBeCloseTo(-SURFACE_SIZE / 2, 12); // -2
  });

  it('maps the domain max-corner to (+SIZE/2, +SIZE/2)', () => {
    const [wx, wz] = paramToWorldXZ(ros[1], ros[3], ros);
    expect(wx).toBeCloseTo(SURFACE_SIZE / 2, 12); // +2
    expect(wz).toBeCloseTo(SURFACE_SIZE / 2, 12); // +2
  });

  it('maps the domain centre to the world origin', () => {
    const [wx, wz] = paramToWorldXZ(0, 0, sphere);
    expect(wx).toBeCloseTo(0, 12);
    expect(wz).toBeCloseTo(0, 12);
  });

  it('round-trips: worldXZToParam ∘ paramToWorldXZ ≈ identity (rosenbrock)', () => {
    const samples: Vec2[] = [
      [-1.2, 1],
      [0, 0],
      [1, 1],
      [-2, -1],
      [2, 3],
      [0.5, -0.5],
    ];
    for (const [px, pz] of samples) {
      const [wx, wz] = paramToWorldXZ(px, pz, ros);
      const [rpx, rpz] = worldXZToParam(wx, wz, ros);
      expect(rpx).toBeCloseTo(px, 10);
      expect(rpz).toBeCloseTo(pz, 10);
    }
  });

  it('round-trips on an asymmetric domain too (sphere is symmetric; use rosenbrock asym y)', () => {
    const [wx, wz] = paramToWorldXZ(-2, 3, ros); // x-min, y-max
    expect(wx).toBeCloseTo(-SURFACE_SIZE / 2, 12);
    expect(wz).toBeCloseTo(SURFACE_SIZE / 2, 12);
    const [rpx, rpz] = worldXZToParam(wx, wz, ros);
    expect(rpx).toBeCloseTo(-2, 10);
    expect(rpz).toBeCloseTo(3, 10);
  });

  it('vScaleFor returns a positive height scale per function (concrete for sphere & rosenbrock)', () => {
    expect(vScaleFor('sphere')).toBeCloseTo(0.03, 12);
    expect(vScaleFor('rosenbrock')).toBeCloseTo(0.0006, 12);
    expect(vScaleFor('does-not-exist')).toBeGreaterThan(0);
  });

  it('costToWorldHeight = vScale·cost; 0 cost → 0 height; monotonic in cost', () => {
    expect(costToWorldHeight(2, 'sphere')).toBeCloseTo(0.06, 12);
    expect(costToWorldHeight(0, 'sphere')).toBe(0);
    expect(costToWorldHeight(8, 'sphere')).toBeGreaterThan(costToWorldHeight(2, 'sphere'));
  });

  it('the chosen vScales put the domain-corner cost near ~1.5 world units (pleasing height)', () => {
    expect(costToWorldHeight(50, 'sphere')).toBeCloseTo(1.5, 12);
    expect(costToWorldHeight(2509, 'rosenbrock')).toBeGreaterThan(1.0);
    expect(costToWorldHeight(2509, 'rosenbrock')).toBeLessThan(2.0);
  });
});
