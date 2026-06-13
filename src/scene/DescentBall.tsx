import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { easing } from 'maath';
import * as THREE from 'three';
import { simStore } from '../state/simStore';
import { useUIStore } from '../state/uiStore';
import { getFunction } from '../engine/functions';
import { paramToWorldXZ, costToWorldHeight } from './surfaceMapping';

/** Radius of the orb in world units; also its resting offset above the surface. */
const BALL_RADIUS = 0.08;

/**
 * The lacquered descent ball (spec §5.3) — the single agent of the M1 cinematic
 * descent.
 *
 * It reads Channel B (simStore) TRANSIENTLY inside useFrame and mutates its own
 * position directly — never setState (the two-channel rule, PRD §8.2). The sim
 * runner writes the TRUE param-space θ into simStore each step; the ball owns
 * the visual SMOOTHING via maath easing.damp3 (framerate-independent), so the
 * orb glides between optimizer steps instead of snapping.
 *
 * World placement is the single source of truth in surfaceMapping.ts (shared
 * with the Surface so the ball sits exactly ON the displaced terrain):
 *   (θx, θy) --paramToWorldXZ--> (worldX, worldZ)
 *   cost     --costToWorldHeight--> worldY  (+ BALL_RADIUS so it rests on top)
 */
export default function DescentBall() {
  const meshRef = useRef<THREE.Mesh>(null);
  // Reusable scratch target so the per-frame math allocates nothing.
  const target = useRef(new THREE.Vector3());
  const functionId = useUIStore((s) => s.functionId);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const { theta, cost } = simStore.getState();
    const fn = getFunction(functionId);

    // Param-space (θx, θy) → world XZ on the SURFACE_SIZE plane.
    const [worldX, worldZ] = paramToWorldXZ(theta[0], theta[1], fn.domain);
    // Cost → world height, lifted by the ball radius so it rests ON the surface.
    const worldY = costToWorldHeight(cost, functionId) + BALL_RADIUS;

    target.current.set(worldX, worldY, worldZ);
    // Critically-damped follow (~0.15s); no overshoot, no per-frame allocation.
    easing.damp3(mesh.position, target.current, 0.15, delta);
  });

  return (
    <mesh ref={meshRef} castShadow>
      <sphereGeometry args={[BALL_RADIUS, 32, 32]} />
      <meshPhysicalMaterial
        color="#0a0a0a"
        roughness={0.3}
        metalness={0}
        clearcoat={1.0}
        clearcoatRoughness={0.05}
        envMapIntensity={1}
        // Emissive cyan core — toneMapped={false} + emissiveIntensity>1 keeps it
        // above the HalfFloat bloom threshold so M1b's selective bloom finds it.
        emissive="#00D3F2"
        emissiveIntensity={3.0}
        toneMapped={false}
      />
    </mesh>
  );
}
