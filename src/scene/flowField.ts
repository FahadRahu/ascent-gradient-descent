import * as THREE from 'three';
import { getFunction } from '../engine/functions';

/** Flow-field bake resolution (PRD §7.2). 256×256 RGBA half-float. */
export const FLOW_TEX_SIZE = 256;

/**
 * Bake the active function's flow field into a 256×256 RGBA HalfFloat DataTexture
 * (SMOKE-TEST RISK #4). Pure TS — uses getFunction(id).grad analytically over the
 * function's domain; no GL context required, so it is fully unit-testable.
 *
 * Texel layout per (u,v) → param point p = (xMin + u·Δx, yMin + v·Δy):
 *   R,G = normalize(−∇J(p))         descent DIRECTION (unit; [−1,1] fits half-float)
 *   B   = g/(1+g), g = ‖∇J(p)‖      soft-normalized SPEED in [0,1) (steep & gentle readable)
 *   A   = 0.5·(∂dirY/∂x − ∂dirX/∂y) pseudo-CURL of the direction field, clamped [−1,1]
 *
 * A true gradient field is curl-free, so we bake the curl of the *normalized
 * direction* field instead: nonzero wherever the flow turns (basins/ridges) —
 * exactly where visible swirl is wanted. Channels are stored as
 * THREE.DataUtils.toHalfFloat bit patterns in a Uint16Array (HalfFloatType REQUIRES
 * Uint16, not Float32). RGBAFormat (not RGB) for Intel-mobile compatibility.
 * NearestFilter + ClampToEdge are DataTexture defaults — intentionally not set.
 */
export function bakeFlowField(functionId: string): THREE.DataTexture {
  const fn = getFunction(functionId);
  const [xMin, xMax, yMin, yMax] = fn.domain;
  const N = FLOW_TEX_SIZE;
  const dx = (xMax - xMin) / (N - 1);
  const dy = (yMax - yMin) / (N - 1);

  const px = (i: number) => xMin + i * dx;
  const py = (j: number) => yMin + j * dy;

  // Unit descent direction at texel (i,j); [0,0] where the gradient vanishes.
  const dir = (i: number, j: number): [number, number] => {
    const [gx, gy] = fn.grad([px(i), py(j)]);
    const mag = Math.hypot(gx, gy);
    if (mag < 1e-9) return [0, 0];
    return [-gx / mag, -gy / mag];
  };

  const data = new Uint16Array(N * N * 4);
  const H = THREE.DataUtils.toHalfFloat;

  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const [dirX, dirY] = dir(i, j);

      // Speed = soft-normalized gradient magnitude (raw ‖∇‖ spans ~6 orders across
      // presets, so g/(1+g) maps any g≥0 into [0,1) — usable as a half-float scalar).
      const [gx, gy] = fn.grad([px(i), py(j)]);
      const g = Math.hypot(gx, gy);
      const speed = g / (1 + g);

      // Pseudo-curl: central-difference rotation of the DIRECTION field. Neighbours
      // clamp at the edges (ClampToEdge semantics) so the bake stays in bounds.
      const iL = Math.max(0, i - 1);
      const iR = Math.min(N - 1, i + 1);
      const jD = Math.max(0, j - 1);
      const jU = Math.min(N - 1, j + 1);
      const dDirY_dx = (dir(iR, j)[1] - dir(iL, j)[1]) / ((iR - iL) * dx || 1);
      const dDirX_dy = (dir(i, jU)[0] - dir(i, jD)[0]) / ((jU - jD) * dy || 1);
      const curl = Math.max(-1, Math.min(1, 0.5 * (dDirY_dx - dDirX_dy)));

      const o = (j * N + i) * 4;
      data[o + 0] = H(dirX);
      data[o + 1] = H(dirY);
      data[o + 2] = H(speed);
      data[o + 3] = H(curl);
    }
  }

  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, THREE.HalfFloatType);
  // NearestFilter + ClampToEdgeWrapping are the DataTexture defaults — do NOT set them.
  tex.needsUpdate = true;
  return tex;
}

/** Decode a single texel back to floats (test helper; mirrors the GPU sampler). */
export function decodeFlowTexel(
  tex: THREE.DataTexture,
  i: number,
  j: number,
): { dirX: number; dirY: number; speed: number; curl: number } {
  const data = tex.image.data as Uint16Array;
  const o = (j * FLOW_TEX_SIZE + i) * 4;
  const F = THREE.DataUtils.fromHalfFloat;
  return { dirX: F(data[o]), dirY: F(data[o + 1]), speed: F(data[o + 2]), curl: F(data[o + 3]) };
}
