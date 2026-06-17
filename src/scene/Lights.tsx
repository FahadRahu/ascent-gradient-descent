import { ContactShadows } from '@react-three/drei';
import { useUIStore } from '../state/uiStore';
import { TIER_SETTINGS } from '../quality/tiers';

/**
 * The scene's light + shadow rig (spec §5.2), keyed off the active tier.
 *
 * - Always: a low ambientLight fill so shadowed faces never read pure black,
 *   plus ONE directional key light from above-front.
 * - The key casts shadows only when the tier budgets for it
 *   (TIER_SETTINGS[tier].shadowMapSize > 0). A TIGHT ortho frustum (±3 for the
 *   SURFACE_SIZE=4 scene) is what makes the shadow crisp — frustum tightness
 *   matters more than raw map size.
 * - shadow-bias / shadow-normalBias kill the displaced-surface acne.
 *
 * Soft-shadow STRATEGY is tier-conditional:
 *   ultra/high → the directional key's real cast shadow via the <Canvas shadows>
 *                PCFSoftShadowMap default (soft-edged percentage-closer filtering).
 *   medium     → drei <ContactShadows frames={1}>  (cheap, baked once).
 *   low/fallback → none if shadowMapSize is 0.
 *
 * ⚠️ drei <SoftShadows> (PCSS) was REMOVED at M1b: it string-patches
 * THREE.ShaderChunk.shadowmap_pars_fragment assuming the legacy RGBA-packed-depth
 * path (`unpackRGBAToDepth(texture2D(shadowMap,…))`), but three 0.184 modernized
 * shadows to `sampler2DShadow` + hardware depth-compare. The patch injects a bare
 * `return` at the uniform-declaration scope (→ `'return': syntax error`) and calls
 * `unpackRGBAToDepth` on a `sampler2DShadow` (→ no-matching-overload), producing an
 * uncompilable fragment shader that BLANKS the whole scene. drei 10.7.7 is the
 * latest 10.x and still ships this; the only fix would downgrade three below the
 * locked `~0.184` pin (which the postprocessing `<0.185` cap + CSM depend on).
 * So PCFSoftShadowMap is the soft-shadow path on this stack. (Pre-existing M1a
 * issue surfaced at the M1b live checkpoint; reproduced on main/v0.2.0-m1a.)
 */
export default function Lights() {
  const tier = useUIStore((s) => s.tier);
  const shadowMapSize = TIER_SETTINGS[tier].shadowMapSize;
  const castShadow = shadowMapSize > 0;
  const useContactShadows = tier === 'medium';

  return (
    <>
      {/* Low neutral fill — keeps shadowed faces from crushing to black. */}
      <ambientLight intensity={0.15} />

      {/* The single directional KEY light. */}
      <directionalLight
        position={[4, 6, 3]}
        intensity={2}
        castShadow={castShadow}
        shadow-mapSize={castShadow ? [shadowMapSize, shadowMapSize] : undefined}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
        // Tight ortho frustum fitted to the 4×4 surface (drives sharpness).
        shadow-camera-near={0.5}
        shadow-camera-far={50}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
      />

      {/* Medium tier: cheap render-once contact shadow under the scene.
          frames={1} is ESSENTIAL — without it this re-renders every frame. */}
      {useContactShadows && (
        <ContactShadows
          frames={1}
          position={[0, -0.01, 0]}
          scale={6}
          resolution={1024}
          blur={2.5}
          opacity={0.5}
          far={4}
          color="#000000"
        />
      )}
    </>
  );
}
