import { useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useUIStore } from '../state/uiStore';
import { TIER_SETTINGS } from '../quality/tiers';
import Lights from './Lights';
import SceneEnvironment from './SceneEnvironment';
import { Surface } from './Surface';
import DescentBall from './DescentBall';
import DescentPath from './DescentPath';
import PostStack from './PostStack';
import EmberRing from './EmberRing';
import HeroBeat from './HeroBeat';
import OptimizationCues from './OptimizationCues';
import CostAxis from './CostAxis';
import { createHeroRefs } from './heroRefs';
import { useSimRunner } from './useSimRunner';

/**
 * In-canvas content (no <Canvas> wrapper) — unit-testable with
 * @react-three/test-renderer. The M1a scene (PRD §5.1): void background +
 * exponential fog, key light + soft shadows, a swappable procedural/HDR
 * environment, the magma CSM surface, and the lacquered descent ball — now with
 * the M1b cinematic layer composing on top (post-stack first). The single sim
 * runner (the one useFrame that owns the descent) is called here because useFrame
 * must execute inside the <Canvas> subtree, and SceneContents IS that in-canvas
 * boundary.
 */
export function SceneContents() {
  // Channel B's driver. Renders nothing; owns the stepper + writes simStore.
  useSimRunner();

  // The single cross-subsystem ref bundle (stable identity). Threaded to every
  // owner so they populate .current; the whole object is handed to HeroBeat.
  const heroRefs = useMemo(() => createHeroRefs(), []);
  const emberRef = useRef<THREE.Mesh>(null);

  return (
    <>
      <color attach="background" args={['#0B0E1A']} />
      {/* Exponential fog in the void colour fades the surface edges into the
          background so the plane never reads as a hard-edged card (PRD §5.1).
          M1b note: re-judge density (0.08) at the Task-19 checkpoint vs the AGX
          grade + bloom (PRD §5.4 starts at 0.025). */}
      <fogExp2 attach="fog" args={[0x0b0e1a, 0.04]} />

      <Lights />
      {/* M1a environment: self-hosted dark-studio HDRI (PRD §6.2). Chosen at the
          Task-15 lighting A/B over the procedural Lightformer rig — the HDR reads
          as pure magma (no cyan clearcoat sheen competing with the colormap). The
          procedural mode stays available via the swappable <SceneEnvironment>
          boundary (mode="procedural") for the M1b post-stack revisit. */}
      <SceneEnvironment mode="hdr" hdr="/hdri/satara_night_no_lamps_1k.hdr" />

      <Surface />
      <CostAxis />
      {/* The stateless ambient swarm — motes streaming downhill over the baked
          flow field. Always mounted; self-gates by tier (fallback renders null). */}
      <OptimizationCues />
      {/* Ball owns position; lifts its material ref so HeroBeat drives the emissive. */}
      <DescentBall materialRef={heroRefs.ballMaterial} />
      {/* Persistent revealed tube; publishes its halo uniform so the cyan/fuchsia
          cue reads even if the live <Trail> NO-GO'd (PathUniforms ⊇ pathHalo's shape). */}
      <DescentPath materialUniformsRef={heroRefs.pathHalo} />
      {/* Live ribbon (publishes its material to the beat for the halo bleed). */}
      {/* The lone ember ring — positioned/animated by HeroBeat in 'settle'. */}
      <EmberRing ref={emberRef} />
      {/* Post-stack — ALWAYS mounted, self-gates by tier; populates bloom/dof/vignette. */}
      <PostStack refs={heroRefs} />
      {/* The integrator — renders nothing; mutates the assembled refs each frame. */}
      <HeroBeat refs={heroRefs} emberRef={emberRef} />
    </>
  );
}

/** App-facing scene: the real Canvas wrapper. */
export function Scene() {
  // Reactive (Channel A) reads. These change rarely and re-rendering <Scene> to
  // update Canvas props (frameloop/dpr) is correct — it does NOT re-render the
  // in-canvas tree's transient state.
  const isPlaying = useUIStore((s) => s.isPlaying);
  const tier = useUIStore((s) => s.tier);

  // Power discipline (PRD §8.3): render every frame only while the descent is
  // animating; otherwise render on demand (camera moves call invalidate() via
  // OrbitControls; the sim runner invalidate()s on rebuild). No scrubber yet
  // (M1c), so "live" is the only mode → frameloop = isPlaying ? always : demand.
  // Toggling frameloop resets clock.elapsedTime, but the stepper uses per-frame
  // delta (fixed-timestep accumulator), so the descent is unaffected.
  const frameloop = isPlaying ? 'always' : 'demand';

  return (
    <Canvas
      shadows
      camera={{ position: [4.8, 5.4, 5.8], fov: 42 }}
      dpr={[Math.min(1.5, TIER_SETTINGS[tier].dpr), TIER_SETTINGS[tier].dpr]}
      frameloop={frameloop}
      onCreated={({ gl }) => {
        gl.domElement.setAttribute('role', 'img');
        gl.domElement.setAttribute(
          'aria-label',
          'Interactive three-dimensional cost landscape. Drag to orbit and scroll to zoom.',
        );
      }}
    >
      <OrbitControls
        makeDefault
        target={[0, 0.18, 0]}
        minDistance={4}
        maxDistance={11}
        maxPolarAngle={Math.PI / 2.05}
        enableDamping
        dampingFactor={0.08}
      />
      <SceneContents />
    </Canvas>
  );
}
