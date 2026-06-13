/**
 * THE single source of truth for the parameter↔world-XZ mapping (LOCKED).
 * The surface is a SURFACE_SIZE × SURFACE_SIZE plane centred at the origin
 * (built in local XY, rotation-x = -PI/2 so local +Z becomes world +Y).
 * Surface.tsx (GPU vertex shader) and DescentBall.tsx both go through here so
 * the ball sits exactly on the displaced terrain.
 *
 * ⚠️ KEEP IN SYNC WITH GLSL: the same linear map is reproduced in
 * src/scene/shaders/surfaceShaders.ts (uParamMin / uParamRange) and the same
 * vScale is sent as the uVScale uniform. M1a hand-writes both; M3 may unify.
 */

import type { Domain } from './surfaceMapping.types';

/** World extent of the (square) surface plane, in world units. LOCKED at 4. */
export const SURFACE_SIZE = 4;

/**
 * Map a parameter-space point (px in [xMin,xMax], pz in [yMin,yMax]) to world
 * XZ in [-SURFACE_SIZE/2, +SURFACE_SIZE/2]². Linear per axis; handles the
 * asymmetric domains (e.g. rosenbrock y∈[-1,3]) via the per-axis offset.
 */
export function paramToWorldXZ(px: number, pz: number, domain: Domain): [number, number] {
  const [xMin, xMax, yMin, yMax] = domain;
  const u = (px - xMin) / (xMax - xMin); // 0..1
  const v = (pz - yMin) / (yMax - yMin); // 0..1
  return [u * SURFACE_SIZE - SURFACE_SIZE / 2, v * SURFACE_SIZE - SURFACE_SIZE / 2];
}

/** Inverse of paramToWorldXZ — world XZ back to parameter space. */
export function worldXZToParam(wx: number, wz: number, domain: Domain): [number, number] {
  const [xMin, xMax, yMin, yMax] = domain;
  const u = (wx + SURFACE_SIZE / 2) / SURFACE_SIZE; // 0..1
  const v = (wz + SURFACE_SIZE / 2) / SURFACE_SIZE; // 0..1
  return [xMin + u * (xMax - xMin), yMin + v * (yMax - yMin)];
}

/**
 * Per-function vertical scale: world height = vScale · cost. Chosen so the
 * worst-corner cost over each function's domain maps to ~1.5 world units.
 * (Execution-derivable: sphere max cost on [-5,5]² is 50 → 1.5/50 = 0.03.)
 */
const V_SCALE: Record<string, number> = {
  sphere: 0.03, // max cost 50  → 1.5
  matyas: 0.015, // max 100 at corner (10,-10) → 1.5
  booth: 0.00058, // max ≈ 2594 at corner (-10,-10) → ~1.5
  rosenbrock: 0.0006, // worst-corner ≈ 2509 → ~1.5
  beale: 0.0000082, // max ≈ 1.82e5 (very steep) → ~1.5
  saddle: 0.17, // |cost| max 9 on [-3,3]² → ~1.5 (signed; see costToWorldHeight)
  himmelblau: 0.0017, // max ≈ 890 on [-5,5]² → ~1.5
  rastrigin: 0.022, // max ≈ 80.7 on [-5.12,5.12]² → ~1.78
  ackley: 0.16, // max ≈ 14.3 on [-5,5]² → ~2.3 (flat-outer plateau dominates)
};

/** Fallback scale for any unregistered id (keeps height positive & sane). */
const DEFAULT_V_SCALE = 0.03;

/** The vertical scale for a function id (used for uVScale + the ball height). */
export function vScaleFor(functionId: string): number {
  return V_SCALE[functionId] ?? DEFAULT_V_SCALE;
}

/**
 * World Y for a given raw cost on a given function. Linear (worldY = vScale·cost),
 * matching the GLSL `csm_Position.z = uVScale * h` exactly. Saddle's cost is
 * signed (x²−y²) and is intentionally NOT clamped — the surface dips below 0.
 */
export function costToWorldHeight(cost: number, functionId: string): number {
  return vScaleFor(functionId) * cost;
}

/** A cost function's sampling domain: [xMin, xMax, yMin, yMax]. */
export type { Domain };
