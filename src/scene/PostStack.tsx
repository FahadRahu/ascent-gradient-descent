import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { HalfFloatType } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import {
  EffectComposer,
  N8AO,
  Bloom,
  DepthOfField,
  SMAA,
  ChromaticAberration,
  Vignette,
  Noise,
  ToneMapping,
} from '@react-three/postprocessing';
import { ToneMappingMode, BlendFunction, VignetteTechnique } from 'postprocessing';
import { easing } from 'maath';
import { useUIStore } from '../state/uiStore';
import { simStore } from '../state/simStore';
import { getFunction } from '../engine/functions';
import { paramToWorldXZ, costToWorldHeight } from './surfaceMapping';
import { POST_CONFIG } from '../quality/postConfig';
import type { HeroRefs } from './heroRefs';

/** Ball radius offset so the focus plane sits on the orb (mirrors DescentBall). */
const BALL_RADIUS = 0.08;

/**
 * Minimal local ref shape for the N8AO pass. n8ao ships no .d.ts and @r3/pp's
 * N8AO.d.ts references an unresolved `N8AOPostPass`, so we type only the field we
 * touch — `configuration.accumulate` — and rely on the project's skipLibCheck.
 */
interface N8AOPassRef {
  configuration: { accumulate: boolean };
}

export interface PostStackProps {
  /** The shared HeroRefs bundle; PostStack attaches bloom/dof/vignette onto it. */
  refs: HeroRefs;
}

/**
 * The merged AGX/HalfFloat post-processing stack (spec §5.4). Mounts INSIDE
 * <Canvas> as a child of SceneContents and is ALWAYS rendered (it self-gates by
 * tier): composer tiers (ultra/high/medium) render the full EffectComposer
 * subtree; low/fallback render no composer and set renderer AGX directly (valid
 * only when no composer is mounted — the composer otherwise pins
 * gl.toneMapping = NoToneMapping for its lifetime; spec §3.1).
 *
 * Owns: the effect refs (attached onto `refs`) and the per-frame DOF rack-focus
 * follow (the only per-frame work — a ref mutation, two-channel-clean). HeroBeat
 * owns the choreography (it writes bloom.intensity / vignette.darkness / dof
 * .bokehScale; PostStack writes dof.target — disjoint properties, no conflict).
 */
export default function PostStack({ refs }: PostStackProps) {
  const tier = useUIStore((s) => s.tier);
  const functionId = useUIStore((s) => s.functionId);
  const gl = useThree((s) => s.gl);
  const cfg = POST_CONFIG[tier];

  const n8aoRef = useRef<N8AOPassRef>(null);
  // The Vector3 passed as <DepthOfField target> — R3F sets effect.target to THIS
  // SAME instance, so `dof.target === focusTarget`. We must NOT damp it toward
  // itself (a no-op). Non-null at mount so autofocus is enabled (null disables it).
  const focusTarget = useMemo(() => new THREE.Vector3(0, 0, 5), []);
  // A SEPARATE scratch goal we recompute each frame; dof.target eases toward it.
  const focusGoal = useMemo(() => new THREE.Vector3(0, 0, 5), []);

  // --- Low/fallback: renderer AGX, no composer. Restore on cleanup so an M1c
  //     runtime swap to a composer tier doesn't leave a stale renderer setting. --
  useEffect(() => {
    if (cfg.mountComposer) return;
    const prev = gl.toneMapping;
    gl.toneMapping = THREE.AgXToneMapping; // ===6, valid only with no composer
    return () => {
      gl.toneMapping = prev;
    };
  }, [cfg.mountComposer, gl]);

  // --- N8AO: force accumulate ON via ref (not a JSX prop; spec §3.4). ----------
  useEffect(() => {
    if (!cfg.mountComposer) return;
    if (n8aoRef.current) n8aoRef.current.configuration.accumulate = true;
  }, [cfg.mountComposer, tier]);

  // --- Per-frame: rack-focus the DOF target onto the ball world position. ------
  //     Read Channel B transiently; compute the focus point the SAME way
  //     DescentBall computes its position (shared surfaceMapping), eased framerate-
  //     independently. Null-guarded — DOF is absent at Medium/Low.
  useFrame((_, delta) => {
    const dof = refs.dof.current;
    if (!dof || !dof.target) return;
    const { theta, cost } = simStore.getState();
    const fn = getFunction(functionId);
    const [wx, wz] = paramToWorldXZ(theta[0], theta[1], fn.domain);
    const wy = costToWorldHeight(cost, functionId) + BALL_RADIUS;
    // Recompute the GOAL on a separate vector, then ease dof.target toward it.
    // (dof.target IS focusTarget — the prop instance — so damping it toward
    // focusTarget would be a self-damp no-op and the focus would snap, not ease.)
    focusGoal.set(wx, wy, wz);
    easing.damp3(dof.target, focusGoal, 0.3, delta);
  });

  // --- Low/fallback: render nothing (the useEffect applied the renderer AGX). ---
  if (!cfg.mountComposer) return null;

  // --- Composer tiers. multisampling={0}: MANDATORY (wrapper defaults to 8; SMAA
  //     + N8AO depth both need MSAA off). frameBufferType={HalfFloatType}: keeps
  //     >1 emissive un-clamped so selective bloom works. Child order = §3.3. ----
  //
  // DepthOfField conditional: EffectComposer's children type is JSX.Element |
  // JSX.Element[] — it rejects false/null in a child slot. So we build the effect
  // children as a SINGLE ordered array and splice DOF in/out (spread an empty
  // array when off). One subtree, no duplication, TS-clean, order preserved
  // (§3.3): N8AO → Bloom → [DOF] → SMAA → CA → Vignette → Noise → ToneMapping.
  const effects = [
    <N8AO
      key="n8ao"
      ref={n8aoRef}
      aoRadius={0.4}
      distanceFalloff={1.0}
      intensity={3}
      color="black"
      quality={cfg.n8ao.quality}
      halfRes={cfg.n8ao.halfRes}
      denoiseRadius={0}
    />,
    <Bloom
      key="bloom"
      ref={refs.bloom}
      mipmapBlur
      intensity={cfg.bloom.intensity}
      luminanceThreshold={0.9}
      luminanceSmoothing={0.025}
      radius={0.7}
      levels={cfg.bloom.levels}
    />,
    ...(cfg.dof
      ? [<DepthOfField key="dof" ref={refs.dof} target={focusTarget} focusRange={0.3} bokehScale={3} resolutionScale={1} />]
      : []),
    <SMAA key="smaa" preset={cfg.smaaPreset} />,
    <ChromaticAberration key="ca" offset={new THREE.Vector2(0.0008, 0.0005)} blendFunction={BlendFunction.NORMAL} />,
    <Vignette key="vignette" ref={refs.vignette} offset={0.35} darkness={0.55} technique={VignetteTechnique.DEFAULT} />,
    <Noise key="noise" premultiply opacity={0.04} blendFunction={BlendFunction.SCREEN} />,
    <ToneMapping key="tonemap" mode={ToneMappingMode.AGX} />,
  ];

  return (
    <EffectComposer multisampling={0} frameBufferType={HalfFloatType}>
      {effects}
    </EffectComposer>
  );
}
