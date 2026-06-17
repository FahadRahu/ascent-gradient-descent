import * as THREE from 'three';
import type { HistoryEntry } from '../engine/stepper';
import type { Domain } from './surfaceMapping.types';
import { paramToWorldXZ, costToWorldHeight } from './surfaceMapping';

/** Lift the ribbon just above the displaced surface so it never z-fights. */
export const PATH_LIFT = 0.04;

/**
 * Max absolute world coordinate a point may have to be safely renderable. The
 * surface plane is SURFACE_SIZE=4 wide (XZ within ±2) and legitimate world-Y is
 * ~±2, so 1e6 is ~250,000× the real extent — it ONLY ever drops divergence
 * garbage. The bound exists because a divergence run's retained "last finite"
 * point can be finite-but-astronomical (an overflowed cost ≈1e226 maps to a
 * finite world-Y ≈6e222); three squares coordinates internally
 * (CatmullRomCurve3.distanceToSquared, MeshLine bounds), and (6e222)² overflows
 * to Infinity → NaN → a render-loop-aborting TypeError. Number.isFinite alone
 * does NOT catch these; the magnitude bound does.
 */
export const WORLD_RENDER_BOUND = 1e6;

/** True if a world point is finite AND within the renderable magnitude bound, so
 *  geometry/curve math on it can never overflow. Shared by the path tube and the
 *  trail anchor so both reject divergence garbage identically. */
export function isRenderableWorldXYZ(x: number, y: number, z: number): boolean {
  return (
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    Number.isFinite(z) &&
    Math.abs(x) <= WORLD_RENDER_BOUND &&
    Math.abs(y) <= WORLD_RENDER_BOUND &&
    Math.abs(z) <= WORLD_RENDER_BOUND
  );
}

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
  // Defense in depth at the render boundary: drop any point that is non-finite OR
  // finite-but-astronomical. A divergence run can hand us either (an overflowed
  // cost ≈1e226 maps to a finite world-Y ≈6e222); CatmullRomCurve3's arc-length
  // lookup squares coordinates, so a huge-but-finite value overflows to Infinity →
  // a NaN index → points[NaN] is undefined → a TypeError that aborts the whole
  // render loop. Filtering first means a geometry primitive can never crash the
  // loop, whatever upstream produced. (The stepper also guards cost-overflow at
  // source, but its retained last-finite point can still be huge.)
  const renderable = points.filter((p) => isRenderableWorldXYZ(p.x, p.y, p.z));
  if (renderable.length < 2) return null;
  const curve = new THREE.CatmullRomCurve3(renderable, false, 'centripetal', 0.5);
  const segments = Math.max(1, Math.min(tubularSegments, renderable.length * 4));
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
