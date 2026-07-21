import { Suspense } from 'react';
import { Environment, Lightformer } from '@react-three/drei';

export interface SceneEnvironmentProps {
  /** 'procedural' = baked Lightformer studio rig; 'hdr' = self-hosted .hdr file. */
  mode: 'procedural' | 'hdr';
  /** Path under /public for the hdr branch. Defaults to the cleanest candidate. */
  hdr?: string;
}

/**
 * Swappable image-based-lighting boundary (spec §5.2). The whole point of this
 * component is that the procedural<->hdr decision (Task 12's A/B) is a one-prop
 * swap.
 *
 * BOTH branches keep `background={false}` — the env is reflections + low-freq
 * fill ONLY; the locked void `#0B0E1A` + fog (set on <Scene>) stay the backdrop.
 * Setting background={true} would overwrite scene.background and hide the void.
 *
 * PMREM is automatic in Three r182: the renderer prefilters whatever texture is
 * assigned to scene.environment when a MeshStandardMaterial-derived material
 * reads it — so no manual PMREMGenerator here. `environmentIntensity={0.6}`
 * writes scene.environmentIntensity (the single global fill knob).
 */
export default function SceneEnvironment({
  mode,
  hdr = '/hdri/satara_night_no_lamps_1k.2184494e.hdr',
}: SceneEnvironmentProps) {
  if (mode === 'hdr') {
    // RGBELoader fetches the .hdr → suspend until it resolves. fallback={null}
    // means the scene renders with no env for one frame (acceptable; the void
    // backdrop carries it).
    return (
      <Suspense fallback={null}>
        <Environment files={hdr} background={false} environmentIntensity={0.6} />
      </Suspense>
    );
  }

  // Procedural dark-studio softbox rig. frames={1} = a single static cube-camera
  // bake at mount (zero per-frame cost). resolution={256} is plenty for a soft,
  // low-frequency env. The three rect emitters give the ball palette-tinted
  // reflections: a dim neutral key + the two brand-accent rims.
  return (
    <Environment frames={1} resolution={256} background={false} environmentIntensity={0.6}>
      {/* Dim white KEY — large soft box above-front, angled down at the scene. */}
      <Lightformer
        form="rect"
        intensity={1.2}
        color="#ffffff"
        scale={[6, 6, 1]}
        position={[0, 5, 4]}
        rotation={[-Math.PI / 4, 0, 0]}
        target={[0, 0, 0]}
      />
      {/* Cyan RIM — from back-left, kicks a cool edge onto the orb's reflections. */}
      <Lightformer
        form="rect"
        intensity={2.5}
        color="#00D3F2"
        scale={[3, 5, 1]}
        position={[-5, 1.5, -3]}
        rotation={[0, Math.PI / 3, 0]}
        target={[0, 0, 0]}
      />
      {/* Ember RIM — from back-right, a warm amber counter-accent. */}
      <Lightformer
        form="rect"
        intensity={1.6}
        color="#FFA23A"
        scale={[3, 5, 1]}
        position={[5, 1.5, -3]}
        rotation={[0, -Math.PI / 3, 0]}
        target={[0, 0, 0]}
      />
    </Environment>
  );
}
