import { forwardRef } from 'react';
import * as THREE from 'three';

/** Inner/outer radius of the ground ring in world units. */
const INNER = 0.14;
const OUTER = 0.2;

/**
 * The lone ember-amber ground-projection ring (spec §5.6 / PRD §5.5). Lies flat
 * (rotation-x = -PI/2), additively blended, toneMapped={false} so selective bloom
 * flares it. Hidden until the settle phase: HeroBeat positions it at the converged
 * ball XZ and drives the material `.opacity` (0→~0.9) + mesh `.scale` (0→1). The
 * ONLY ember in the scene.
 */
const EmberRing = forwardRef<THREE.Mesh>(function EmberRing(_props, ref) {
  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2} visible={false} scale={0.001}>
      <ringGeometry args={[INNER, OUTER, 64]} />
      <meshBasicMaterial
        color="#FFA23A"
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );
});

export default EmberRing;
