import { useRef } from 'react';
import type { RefObject } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { easing } from 'maath';
import * as THREE from 'three';
import { simStore } from '../state/simStore';
import { useUIStore } from '../state/uiStore';
import { getFunction } from '../engine/functions';
import type { Vec2 } from '../engine/types';
import { paramToWorldXZ, costToWorldHeight } from './surfaceMapping';
import type { Domain } from './surfaceMapping.types';

/** Radius of the orb in world units; also its resting offset above the surface. */
const BALL_RADIUS = 0.095;
const LABEL_COLLISION_FRAC = 0.1;

export function shouldShowCurrentLabel(
  theta: Vec2,
  target: Vec2,
  domain: Domain,
): boolean {
  const [xMin, xMax, yMin, yMax] = domain;
  const extent = Math.max(xMax - xMin, yMax - yMin);
  return Math.hypot(theta[0] - target[0], theta[1] - target[1]) / extent >=
    LABEL_COLLISION_FRAC;
}

export interface DescentBallProps {
  /** Optional external ref to the orb's material so the hero beat can drive its
   *  emissive intensity/colour during the arrival beat. Position stays owned here. */
  materialRef?: RefObject<THREE.MeshPhysicalMaterial | null>;
}

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
 *
 * M1b: accepts an optional `materialRef` so HeroBeat can drive the emissive flash/
 * settle/dim during the arrival beat. The ball still owns position; the beat owns
 * appearance. The prop is optional so the component stays usable standalone.
 */
export default function DescentBall({ materialRef }: DescentBallProps = {}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const invalidate = useThree((state) => state.invalidate);
  // Reusable scratch target so the per-frame math allocates nothing.
  const target = useRef(new THREE.Vector3());
  const functionId = useUIStore((s) => s.functionId);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const { theta, cost } = simStore.getState();
    const fn = getFunction(functionId);
    const showLabel = shouldShowCurrentLabel(
      theta,
      fn.minima[0] as Vec2,
      fn.domain,
    );
    if (labelRef.current && labelRef.current.hidden === showLabel) {
      labelRef.current.hidden = !showLabel;
    }

    // Param-space (θx, θy) → world XZ on the SURFACE_SIZE plane.
    const [worldX, worldZ] = paramToWorldXZ(theta[0], theta[1], fn.domain);
    // Cost → world height, lifted by the ball radius so it rests ON the surface.
    const worldY = costToWorldHeight(cost, functionId) + BALL_RADIUS;

    target.current.set(worldX, worldY, worldZ);
    // Critically-damped follow (~0.15s); no overshoot, no per-frame allocation.
    easing.damp3(mesh.position, target.current, 0.15, delta);
    if (mesh.position.distanceToSquared(target.current) > 1e-6) invalidate();
  });

  return (
    <mesh ref={meshRef} castShadow>
      <sphereGeometry args={[BALL_RADIUS, 48, 48]} />
      <meshPhysicalMaterial
        ref={materialRef}
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
      <Html
        center
        position={[0, BALL_RADIUS + 0.14, 0]}
        distanceFactor={6}
        zIndexRange={[3, 1]}
        style={{ pointerEvents: 'none' }}
      >
        <span
          ref={labelRef}
          className="scene-label scene-label-current"
          aria-hidden="true"
        >
          Current point
        </span>
      </Html>
    </mesh>
  );
}
