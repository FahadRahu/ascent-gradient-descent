import * as THREE from 'three';
import { FLOW_TEX_SIZE, bakeFlowField, decodeFlowTexel } from './flowField';

describe('flowField — baked half-float DataTexture (Risk #4, encode/decode)', () => {
  it('builds a 256x256 RGBA half-float DataTexture backed by a Uint16Array', () => {
    const tex = bakeFlowField('sphere');
    expect(tex.image.width).toBe(FLOW_TEX_SIZE);
    expect(tex.image.height).toBe(FLOW_TEX_SIZE);
    expect(tex.format).toBe(THREE.RGBAFormat);
    expect(tex.type).toBe(THREE.HalfFloatType);
    expect(tex.image.data).toBeInstanceOf(Uint16Array);
    expect((tex.image.data as Uint16Array).length).toBe(FLOW_TEX_SIZE * FLOW_TEX_SIZE * 4);
  });

  it('decodes RG ~ normalize(-grad) for sphere at an off-origin texel', () => {
    // sphere grad = [2x, 2y]; at +x,+y the descent direction is toward the origin
    // → normalize(-[2x,2y]) = normalize([-x,-y]). At i=192,j=192 (upper-right
    // quadrant, x>0,y>0), dir ~ (-0.707, -0.707).
    const tex = bakeFlowField('sphere');
    const i = 192;
    const j = 192;
    const { dirX, dirY, speed, curl } = decodeFlowTexel(tex, i, j);
    const mag = Math.hypot(dirX, dirY);
    expect(mag).toBeCloseTo(1, 2); // unit direction
    expect(dirX).toBeLessThan(0); // points back toward origin
    expect(dirY).toBeLessThan(0);
    expect(dirX).toBeCloseTo(-0.7071, 2); // half-float-safe to 2 decimals
    expect(dirY).toBeCloseTo(-0.7071, 2);
    expect(speed).toBeGreaterThanOrEqual(0);
    expect(speed).toBeLessThan(1); // g/(1+g) ∈ [0,1)
    expect(curl).toBeGreaterThanOrEqual(-1);
    expect(curl).toBeLessThanOrEqual(1);
  });

  it('emits a near-zero SPEED where the gradient vanishes (texel nearest origin)', () => {
    // sphere domain [-5,5]; 256 is even so no texel lands exactly on 0 — the
    // nearest is x≈0.0196, where ‖∇‖≈0.055. The DIRECTION is still normalized to
    // unit length there (it only zeroes when ‖∇‖<1e-9), so assert on the SPEED
    // channel g/(1+g), which →0 as ‖∇‖→0. (This is the channel that vanishes at
    // a minimum; direction never does.)
    const tex = bakeFlowField('sphere');
    const mid = Math.round((0 - -5) / (10 / (FLOW_TEX_SIZE - 1))); // i for x≈0.0196
    const { speed } = decodeFlowTexel(tex, mid, mid);
    expect(speed).toBeLessThan(0.1); // g≈0.055 → g/(1+g)≈0.053
  });
});
