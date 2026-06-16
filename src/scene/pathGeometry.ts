import * as THREE from 'three';
import type { HistoryEntry } from '../engine/stepper';
import type { Domain } from './surfaceMapping.types';
import { paramToWorldXZ, costToWorldHeight } from './surfaceMapping';

/** Lift the ribbon just above the displaced surface so it never z-fights. */
export const PATH_LIFT = 0.04;

/**
 * Convert the stepper history polyline (param-space θ + cost per entry) to
 * world-space points on the SURFACE_SIZE plane — the SAME mapping the ball and
 * the GPU surface use, so the ribbon lies exactly on the terrain (+ a small lift).
 */
export function historyToWorldPoints(
  history: readonly HistoryEntry[],
  domain: Domain,
  functionId: string,
): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (const h of history) {
    const [wx, wz] = paramToWorldXZ(h.theta[0], h.theta[1], domain);
    const wy = costToWorldHeight(h.cost, functionId) + PATH_LIFT;
    pts.push(new THREE.Vector3(wx, wy, wz));
  }
  return pts;
}

/**
 * Build a TubeGeometry along the descent polyline, or null if fewer than 2
 * points (CatmullRomCurve3 needs >=2; a 1-point run is degenerate). The
 * tubularSegments cap gives a constant vertex budget regardless of iteration
 * count. closed=false so the built-in uv.x runs 0->1 along the tube (the reveal
 * coordinate). centripetal curveType avoids loops on the sharp Rosenbrock zig-zag.
 */
export function buildTubeGeometry(
  points: THREE.Vector3[],
  tubularSegments: number,
  radius: number,
  radialSegments: number,
): THREE.TubeGeometry | null {
  if (points.length < 2) return null;
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
  const segments = Math.max(1, Math.min(tubularSegments, points.length * 4));
  return new THREE.TubeGeometry(curve, segments, radius, radialSegments, false);
}

/**
 * Frame-rate-independent reveal fraction in [0,1]. `built` is the iteration count
 * baked into the CURRENT geometry; `current` is the live stepper iteration.
 * Because the geometry is rebuilt whenever history grows, this rides at ~1.0 (the
 * tube tip IS the ball), so the smoothstep edge renders a soft leading glow at
 * the tip. Guards built<=0 (returns 0).
 */
export function revealProgress(current: number, built: number): number {
  if (built <= 0) return 0;
  return Math.min(Math.max(current / built, 0), 1);
}
