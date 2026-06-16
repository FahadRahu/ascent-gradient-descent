import * as THREE from 'three';
import {
  PATH_LIFT,
  historyToWorldPoints,
  buildTubeGeometry,
  revealProgress,
} from './pathGeometry';
import { getFunction } from '../engine/functions';
import { paramToWorldXZ, costToWorldHeight } from './surfaceMapping';
import type { HistoryEntry } from '../engine/stepper';

describe('pathGeometry — descent ribbon math', () => {
  const sphere = getFunction('sphere');
  const hist: HistoryEntry[] = [
    { iteration: 0, theta: [1, 1], cost: 2 },
    { iteration: 1, theta: [0.8, 0.8], cost: 1.28 },
    { iteration: 2, theta: [0.64, 0.64], cost: 0.8192 },
  ];

  it('maps history to world points via the shared surfaceMapping (+ PATH_LIFT)', () => {
    const pts = historyToWorldPoints(hist, sphere.domain, 'sphere');
    expect(pts).toHaveLength(3);
    const [wx, wz] = paramToWorldXZ(1, 1, sphere.domain);
    const wy = costToWorldHeight(2, 'sphere') + PATH_LIFT;
    expect(pts[0].x).toBeCloseTo(wx, 10);
    expect(pts[0].y).toBeCloseTo(wy, 10);
    expect(pts[0].z).toBeCloseTo(wz, 10);
  });

  it('returns null for fewer than 2 points (degenerate curve)', () => {
    expect(buildTubeGeometry([], 64, 0.02, 8)).toBeNull();
    expect(buildTubeGeometry([new THREE.Vector3()], 64, 0.02, 8)).toBeNull();
  });

  it('builds a TubeGeometry with a uv attribute for >=2 points', () => {
    const pts = historyToWorldPoints(hist, sphere.domain, 'sphere');
    const geo = buildTubeGeometry(pts, 64, 0.02, 8);
    expect(geo).toBeInstanceOf(THREE.TubeGeometry);
    expect(geo!.attributes.uv).toBeDefined();
  });

  it('caps the vertex count regardless of a long history (constant budget)', () => {
    const long: HistoryEntry[] = Array.from({ length: 4000 }, (_, i) => ({
      iteration: i,
      theta: [Math.cos(i * 0.01), Math.sin(i * 0.01)] as [number, number],
      cost: 1,
    }));
    const pts = historyToWorldPoints(long, sphere.domain, 'sphere');
    const geo = buildTubeGeometry(pts, 256, 0.02, 8)!;
    // (tubularSegments + 1) * (radialSegments + 1) position verts; tubular capped at 256.
    expect(geo.attributes.position.count).toBeLessThanOrEqual((256 + 1) * (8 + 1));
  });

  it('revealProgress clamps to [0,1] and is 0 when built<=0', () => {
    expect(revealProgress(5, 0)).toBe(0);
    expect(revealProgress(3, 10)).toBeCloseTo(0.3, 10);
    expect(revealProgress(50, 10)).toBe(1);
  });
});
