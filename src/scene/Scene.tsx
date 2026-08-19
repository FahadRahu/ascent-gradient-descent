import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
} from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import { useUIStore } from '../state/uiStore';
import { higherTier, lowerTier, TIER_SETTINGS } from '../quality/tiers';
import Lights from './Lights';
import SceneEnvironment from './SceneEnvironment';
import { Surface } from './Surface';
import DescentBall from './DescentBall';
import DescentPath from './DescentPath';
import EmberRing from './EmberRing';
import HeroBeat from './HeroBeat';
import OptimizationCues from './OptimizationCues';
import CostAxis from './CostAxis';
import { createHeroRefs, type HeroRefs } from './heroRefs';
import { useSimRunner } from './useSimRunner';

const LazyPostStack = lazy(() => import('./PostStack'));

const DEFAULT_CAMERA_POSITION = [4.8, 5.4, 5.8] as const;
const DEFAULT_CAMERA_TARGET = [0, 0.18, 0] as const;

function DeferredPostStack({ refs }: { refs: HeroRefs }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const requestIdle = window.requestIdleCallback;
    if (requestIdle) {
      const handle = requestIdle(() => setReady(true), { timeout: 1_200 });
      return () => window.cancelIdleCallback(handle);
    }

    const handle = window.setTimeout(() => setReady(true), 250);
    return () => window.clearTimeout(handle);
  }, []);

  if (!ready) return null;

  return (
    <Suspense fallback={null}>
      <LazyPostStack refs={refs} />
    </Suspense>
  );
}

function CameraControls() {
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);
  const resetRequest = useUIStore((state) => state.cameraResetRequest);
  const { camera, invalidate } = useThree();

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    camera.position.set(...DEFAULT_CAMERA_POSITION);
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    controls.target.set(...DEFAULT_CAMERA_TARGET);
    controls.update();
    controls.saveState();
    invalidate();
  }, [camera, invalidate, resetRequest]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      target={DEFAULT_CAMERA_TARGET}
      minDistance={4}
      maxDistance={11}
      maxPolarAngle={Math.PI / 2.05}
      enableDamping
      dampingFactor={0.08}
    />
  );
}

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
  const tier = useUIStore((state) => state.tier);

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
      <SceneEnvironment
        mode={tier === 'low' || tier === 'medium' ? 'procedural' : 'hdr'}
        hdr="/hdri/satara_night_no_lamps_1k.2184494e.hdr"
      />

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
      <DeferredPostStack refs={heroRefs} />
      {/* The integrator — renders nothing; mutates the assembled refs each frame. */}
      <HeroBeat refs={heroRefs} emberRef={emberRef} />
    </>
  );
}

function AdaptiveQuality() {
  const tier = useUIStore((state) => state.tier);
  const ceiling = useUIStore((state) => state.qualityCeiling);
  const setTier = useUIStore((state) => state.setTier);

  const decline = useCallback(() => {
    const next = lowerTier(tier);
    if (next !== tier) setTier(next);
  }, [setTier, tier]);

  const incline = useCallback(() => {
    const next = higherTier(tier, ceiling);
    if (next !== tier) setTier(next);
  }, [ceiling, setTier, tier]);

  return (
    <PerformanceMonitor
      iterations={8}
      ms={300}
      threshold={0.7}
      flipflops={3}
      onDecline={decline}
      onIncline={incline}
      onFallback={() => setTier('low')}
    />
  );
}

function ContextLossListener({ onFailure }: { onFailure?: () => void }) {
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    const canvas = gl.domElement;
    const onContextLost = (event: Event) => {
      event.preventDefault();
      onFailure?.();
    };
    canvas.addEventListener('webglcontextlost', onContextLost);
    return () => canvas.removeEventListener('webglcontextlost', onContextLost);
  }, [gl, onFailure]);

  return null;
}

export interface SceneProps {
  onReady?: () => void;
  onFailure?: () => void;
}

/** App-facing scene: the real Canvas wrapper. */
export function Scene({ onReady, onFailure }: SceneProps) {
  // Reactive (Channel A) reads. These change rarely and re-rendering <Scene> to
  // update Canvas props (frameloop/dpr) is correct — it does NOT re-render the
  // in-canvas tree's transient state.
  const isPlaying = useUIStore((s) => s.isPlaying);
  const mode = useUIStore((s) => s.mode);
  const tier = useUIStore((s) => s.tier);
  const settings = TIER_SETTINGS[tier];

  // Review playback is timer-driven and invalidates only when the selected entry
  // changes. The continuous render loop is reserved for a live descent.
  const frameloop = mode === 'live' && isPlaying ? 'always' : 'demand';

  useEffect(() => {
    if (!settings.mountCanvas) onFailure?.();
  }, [onFailure, settings.mountCanvas]);

  if (!settings.mountCanvas) return null;

  return (
    <Canvas
      shadows={settings.shadowMapSize > 0 ? 'basic' : false}
      camera={{ position: DEFAULT_CAMERA_POSITION, fov: 42 }}
      dpr={[Math.min(1.5, settings.dpr), settings.dpr]}
      frameloop={frameloop}
      onCreated={({ gl }) => {
        gl.domElement.setAttribute('role', 'img');
        gl.domElement.setAttribute(
          'aria-label',
          'Interactive three-dimensional cost landscape. Drag to orbit, right-drag to pan, and scroll to zoom.',
        );
        onReady?.();
      }}
    >
      <AdaptiveQuality />
      <ContextLossListener onFailure={onFailure} />
      <CameraControls />
      <SceneContents />
    </Canvas>
  );
}
