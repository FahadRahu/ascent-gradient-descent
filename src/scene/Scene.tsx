import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useUIStore } from '../state/uiStore';
import { TIER_SETTINGS } from '../quality/tiers';
import Lights from './Lights';
import SceneEnvironment from './SceneEnvironment';
import { Surface } from './Surface';
import DescentBall from './DescentBall';
import { useSimRunner } from './useSimRunner';

/**
 * In-canvas content (no <Canvas> wrapper) — unit-testable with
 * @react-three/test-renderer. The full M1a scene (PRD §5.1): void background +
 * exponential fog, key light + soft shadows, a swappable procedural/HDR
 * environment, the magma CSM surface, and the lacquered descent ball. The single
 * sim runner (the one useFrame that owns the descent) is called here because
 * useFrame must execute inside the <Canvas> subtree, and SceneContents IS that
 * in-canvas boundary.
 */
export function SceneContents() {
  // Channel B's driver. Renders nothing; owns the stepper + writes simStore.
  useSimRunner();

  return (
    <>
      <color attach="background" args={['#0B0E1A']} />
      {/* Exponential fog in the void colour fades the surface edges into the
          background so the plane never reads as a hard-edged card (PRD §5.1). */}
      <fogExp2 attach="fog" args={[0x0b0e1a, 0.08]} />

      <Lights />
      {/* M1a default: procedural environment (no network/HDR fetch). The HDR
          path is swappable via mode and exercised in M1b. */}
      <SceneEnvironment mode="procedural" />

      <Surface />
      <DescentBall />
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
      camera={{ position: [3, 3, 3], fov: 50 }}
      dpr={[1, TIER_SETTINGS[tier].dpr]}
      frameloop={frameloop}
    >
      <OrbitControls makeDefault />
      <SceneContents />
    </Canvas>
  );
}
