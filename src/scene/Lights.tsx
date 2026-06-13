import { SoftShadows, ContactShadows } from '@react-three/drei';
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
 *   ultra/high → drei <SoftShadows>  (percentage-closer soft shadows)
 *   medium     → drei <ContactShadows frames={1}>  (cheap, baked once)
 *   low/fallback → neither (the hard PCF shadow, or none if map size is 0)
 *
 * ⚠️ <SoftShadows> GOTCHA: it globally patches THREE.ShaderChunk and recompiles
 * ALL materials on mount AND on any prop change. Its props here are STATIC
 * per-tier constants — never bind them to an animated/interactive value, or
 * every frame triggers a full shader recompile and tanks the frame rate.
 */
export default function Lights() {
  const tier = useUIStore((s) => s.tier);
  const shadowMapSize = TIER_SETTINGS[tier].shadowMapSize;
  const castShadow = shadowMapSize > 0;
  const useSoftShadows = tier === 'ultra' || tier === 'high';
  const useContactShadows = tier === 'medium';

  return (
    <>
      {/* SoftShadows mounted ONCE at this tier; static props (see gotcha above). */}
      {useSoftShadows && <SoftShadows size={25} samples={10} focus={0} />}

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
