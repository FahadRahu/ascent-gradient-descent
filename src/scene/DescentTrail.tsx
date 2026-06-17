import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Trail } from '@react-three/drei';
import type { MeshLineGeometry } from '@react-three/drei';
import { easing } from 'maath';
import { simStore } from '../state/simStore';
import { useUIStore } from '../state/uiStore';
import { getFunction } from '../engine/functions';
import { paramToWorldXZ, costToWorldHeight } from './surfaceMapping';
import { isRenderableWorldXYZ } from './pathGeometry';

/** Resting lift of the trail anchor above the surface (matches the ball core). */
const TRAIL_LIFT = 0.04;

/** The runtime shape of the portaled trail mesh's MeshLineMaterial — its `.color`
 *  is a LIVE THREE.Color uniform the hero beat eases in place (never the prop).
 *  Used only as the cast target for the published material handle. */
type TrailLineMaterial = THREE.Material & { color: THREE.Color };

export interface DescentTrailProps {
  /** Optional: published so the hero beat can ease the live ribbon halo color. */
  materialRef?: RefObject<TrailLineMaterial | null>;
}

/**
 * The live trail ribbon (drei <Trail>, meshline). Self-contained: hosts an
 * invisible anchor mesh as the Trail's first child and damps it to the same world
 * target the ball uses (transient simStore read — two-channel rule). The color is
 * set ONCE via the prop (initial cyan); the hero beat eases the material's .color
 * IN PLACE (changing the prop per frame rebuilds the material → hitch).
 *
 * Risk #2 (drei <Trail>/meshline under R3F 9.6) was smoke-tested GO at the M1b
 * Task-5 live checkpoint, so the live ribbon ships. (If it had been NO-GO, this
 * body would be `return null;` and the persistent DescentPath would carry the
 * ribbon, with the hero beat's trailMaterial ref left null.)
 */
export default function DescentTrail({ materialRef }: DescentTrailProps = {}) {
  const anchorRef = useRef<THREE.Mesh>(null);
  // drei forwards the <Trail> ref as `MeshLineGeometry` (= Mesh & MeshLineGeometryImpl)
  // — use that exact type or tsc rejects the ref (TS2322). Its `.material` is the
  // MeshLineMaterial at runtime (typed Material|Material[], so cast on publish).
  const trailRef = useRef<MeshLineGeometry>(null);
  const target = useRef(new THREE.Vector3());
  const functionId = useUIStore((s) => s.functionId);

  // Publish the live trail material to the shared ref once it resolves (the trail
  // mesh is portaled + anchor-resolved ~1 frame late, so poll until present).
  useFrame((_, delta) => {
    const anchor = anchorRef.current;
    if (anchor) {
      const { theta, cost } = simStore.getState();
      const fn = getFunction(functionId);
      const [wx, wz] = paramToWorldXZ(theta[0], theta[1], fn.domain);
      const wy = costToWorldHeight(cost, functionId) + TRAIL_LIFT;
      // On divergence the world target is non-finite or astronomical (an overflowed
      // cost → a huge world-Y); damping toward it would feed NaN/Inf into meshline's
      // bounding-sphere math (a console-flooding warning). Only follow renderable
      // targets — the ribbon simply holds its last good position past divergence.
      if (isRenderableWorldXYZ(wx, wy, wz)) {
        target.current.set(wx, wy, wz);
        easing.damp3(anchor.position, target.current, 0.15, delta); // matches the ball
      }
    }
    const mat = trailRef.current?.material as TrailLineMaterial | undefined;
    if (materialRef && mat && materialRef.current !== mat) {
      materialRef.current = mat; // single MeshLineMaterial at runtime; cast is safe
    }
  });

  useEffect(() => {
    return () => {
      if (materialRef) materialRef.current = null;
    };
  }, [materialRef]);

  return (
    <Trail
      ref={trailRef}
      width={1.2}
      length={6}
      decay={1.2}
      color="#00D3F2" /* initial halo tint; eased via the material ref, NOT the prop */
      attenuation={(w) => w * w}
    >
      <mesh ref={anchorRef} visible={false}>
        <sphereGeometry args={[0.001, 4, 4]} />
        <meshBasicMaterial />
      </mesh>
    </Trail>
  );
}
