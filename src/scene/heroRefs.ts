import * as THREE from 'three';
import type { RefObject } from 'react';
import type { BloomEffect, DepthOfFieldEffect, VignetteEffect } from 'postprocessing';

/**
 * The single cross-subsystem ref seam for the M1b cinematic layer (spec §5.6).
 * SceneContents creates this ONCE (stable identity), passes the matching ref to
 * each OWNER subsystem so they populate `.current`, and passes the whole object
 * to <HeroBeat>, which only ever MUTATES the referenced objects inside its single
 * useFrame (the two-channel rule — no setState).
 *
 * Owners:  ballMaterial ← DescentBall · trailMaterial + pathHalo ← DescentTrail /
 *          DescentPath · bloom/dof/vignette ← PostStack.
 * Consumer: HeroBeat (mutates ball emissive, trail color, path halo uniform,
 *          bloom.intensity, dof.bokehScale, vignette.darkness).
 *
 * Any ref may be null at runtime — a tier without a composer leaves bloom/dof/
 * vignette null; a Trail that failed its smoke test leaves trailMaterial null
 * (but pathHalo survives → the approach/divergence halo cue still reads on the
 * persistent tube). HeroBeat MUST null-guard every consumer. That nullability IS
 * the tier/fallback story: on Low the beat degrades to the emissive choreography
 * + ember ring + the tube halo.
 *
 * `pathHalo` is typed structurally (just the uHaloColor uniform HeroBeat eases)
 * so heroRefs.ts need not import the PathUniforms type from the DescentPath
 * component module — DescentPath's PathUniforms is assignable to it.
 */
export interface HeroRefs {
  /** Lacquered ball's MeshPhysicalMaterial (owned by DescentBall). */
  ballMaterial: RefObject<THREE.MeshPhysicalMaterial | null>;
  /** Live trail ribbon material — its `.color` is the HALO hue (owned by DescentTrail). */
  trailMaterial: RefObject<(THREE.Material & { color: THREE.Color }) | null>;
  /** Persistent tube's halo uniform — survives a Trail NO-GO so the cyan/fuchsia
   *  halo cue always reads (owned by DescentPath; structurally = PathUniforms). */
  pathHalo: RefObject<{ uHaloColor: { value: THREE.Color } } | null>;
  /** Selective bloom effect — `.intensity` live setter (owned by PostStack). */
  bloom: RefObject<BloomEffect | null>;
  /** DOF effect — HeroBeat writes only `.bokehScale` (owned by PostStack). */
  dof: RefObject<DepthOfFieldEffect | null>;
  /** Vignette effect — `.darkness` live setter (owned by PostStack). */
  vignette: RefObject<VignetteEffect | null>;
}

/** Construct an all-null HeroRefs. Call ONCE in SceneContents (useMemo-wrapped). */
export function createHeroRefs(): HeroRefs {
  return {
    ballMaterial: { current: null },
    trailMaterial: { current: null },
    pathHalo: { current: null },
    bloom: { current: null },
    dof: { current: null },
    vignette: { current: null },
  };
}
