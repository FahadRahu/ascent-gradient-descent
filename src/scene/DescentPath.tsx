import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import CustomShaderMaterial from 'three-custom-shader-material';
import { useUIStore } from '../state/uiStore';
import { getFunction } from '../engine/functions';
import type { Tier } from '../quality/tiers';
import { historyToWorldPoints, buildTubeGeometry, revealProgress } from './pathGeometry';
import { getSimRunnerHandle } from '../state/simHistory';
import { resolveHistorySelection } from '../state/playbackHistory';
import { pathVertexShader, pathFragmentShader } from './shaders/pathShaders';
import type { HaloUniformRef } from './heroRefs';

/** Slim filament radius; the glow does the rest. */
const PATH_RADIUS = 0.012;

/** PRD §5.3 trail palette: white-hot core (#FFF4E6) HDR (3.5) + SGD-cyan halo (1.8). */
const CORE_HDR = new THREE.Color('#FFF4E6').multiplyScalar(1.6);
const HALO_CYAN = new THREE.Color('#00D3F2').multiplyScalar(1.2);

/** Per-tier tube budget (constant vertex count regardless of iteration count). */
function pathBudget(tier: Tier): { tubular: number; radial: number } {
  switch (tier) {
    case 'ultra': return { tubular: 512, radial: 8 };
    case 'high': return { tubular: 384, radial: 8 };
    case 'medium': return { tubular: 256, radial: 6 };
    default: return { tubular: 128, radial: 5 }; // low / fallback
  }
}

export interface PathUniforms {
  [key: string]: { value: unknown };
  uProgress: { value: number };
  uEdge: { value: number };
  uHaloColor: { value: THREE.Color };
  uCoreColor: { value: THREE.Color };
}

export interface DescentPathProps {
  /** Optional: published so the hero beat can ease the ribbon halo color
   *  (uHaloColor — cyan→fuchsia on divergence) even when the live <Trail> is
   *  absent (the Risk #2 NO-GO fallback). Typed as the SHARED `HaloUniformRef`
   *  (not the wider PathUniforms) so `materialUniformsRef={heroRefs.pathHalo}`
   *  typechecks — RefObject is invariant, so both sides must use the same type.
   *  The component still WRITES its full PathUniforms into it (covariant). */
  materialUniformsRef?: RefObject<HaloUniformRef | null>;
}

/**
 * The persistent revealed descent ribbon (PRD §5.3 / §6.5): one TubeGeometry along
 * the stepper polyline, revealed by uProgress via smoothstep on the tube's uv.x.
 *
 * Two-channel rule (strict): the geometry is mutated DIRECTLY on the mesh ref and
 * a frame is requested via invalidate() — NO setState per frame. Rebuild happens
 * only when the polyline grows (gated on history.length) or resets on runId
 * change; uProgress is a pure ref-driven uniform write each frame.
 */
export default function DescentPath({ materialUniformsRef }: DescentPathProps = {}) {
  const tier = useUIStore((s) => s.tier);
  const invalidate = useThree((s) => s.invalidate);

  const meshRef = useRef<THREE.Mesh>(null);
  const lastRunId = useRef(-1);
  const lastLen = useRef(0);
  const lastTipIteration = useRef(-1);
  const builtIteration = useRef(0);

  const uniforms = useMemo<PathUniforms>(
    () => ({
      uProgress: { value: 0 },
      uEdge: { value: 0.06 },
      uHaloColor: { value: HALO_CYAN.clone() },
      uCoreColor: { value: CORE_HDR.clone() },
    }),
    [],
  );

  // Publish the uniforms object so the hero beat can ease uHaloColor (Phase D).
  useEffect(() => {
    if (materialUniformsRef) materialUniformsRef.current = uniforms;
    return () => {
      if (materialUniformsRef) materialUniformsRef.current = null;
    };
  }, [materialUniformsRef, uniforms]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const h = getSimRunnerHandle();
    const { functionId, mode, scrubIndex } = useUIStore.getState();
    const fn = getFunction(functionId);
    const history = h.history;
    const selection = resolveHistorySelection(history, mode, scrubIndex);
    const tipIteration = selection.selected?.iteration ?? -1;

    // Run change → dispose + reset (rebuilt below from >=2 points).
    if (h.runId !== lastRunId.current) {
      lastRunId.current = h.runId;
      lastLen.current = 0;
      lastTipIteration.current = -1;
      builtIteration.current = 0;
      const old = mesh.geometry;
      mesh.geometry = EMPTY_GEOMETRY;
      if (old && old !== EMPTY_GEOMETRY) old.dispose();
      mesh.visible = false;
      invalidate();
    }

    // Review can move backward as well as forward. Rebuild whenever the visible
    // prefix changes, including when a full retained window shifts at its cap.
    if (
      selection.visibleLength !== lastLen.current ||
      tipIteration !== lastTipIteration.current
    ) {
      lastLen.current = selection.visibleLength;
      lastTipIteration.current = tipIteration;
      builtIteration.current = tipIteration;

      if (selection.visibleLength < 2) {
        const old = mesh.geometry;
        mesh.geometry = EMPTY_GEOMETRY;
        if (old && old !== EMPTY_GEOMETRY) old.dispose();
        mesh.visible = false;
        invalidate();
      } else {
        const { tubular, radial } = pathBudget(tier);
        const visibleHistory = history.slice(0, selection.visibleLength);
        const pts = historyToWorldPoints(visibleHistory, fn.domain, functionId);
        const next = buildTubeGeometry(pts, tubular, PATH_RADIUS, radial);
        if (next) {
          const old = mesh.geometry;
          mesh.geometry = next;
          if (old && old !== EMPTY_GEOMETRY) old.dispose();
          mesh.visible = true;
          invalidate();
        }
      }
    }

    // In review the selected point is the path tip; in live mode this preserves
    // the existing frame-rate-independent reveal behavior.
    uniforms.uProgress.value = revealProgress(tipIteration, builtIteration.current);
  });

  // Seed the empty sentinel geometry ONCE at mount and dispose the live geometry
  // on unmount. We do NOT render a <primitive attach="geometry"> child: that hands
  // geometry ownership to R3F's reconciler, which on detach restores the auto-
  // created default geometry (not our swapped tube) and fights the per-frame
  // mesh.geometry swap. Assigning it ourselves keeps the useFrame swap the ONLY
  // writer to mesh.geometry, so the unmount dispose is unambiguous. (A bare <mesh>
  // gets a throwaway default BufferGeometry from three — dispose it, then install
  // our shared sentinel.)
  useEffect(() => {
    const mesh = meshRef.current;
    if (mesh && mesh.geometry !== EMPTY_GEOMETRY) {
      const auto = mesh.geometry; // three's default, created for a child-less mesh
      mesh.geometry = EMPTY_GEOMETRY;
      auto?.dispose();
    }
    return () => {
      const g = mesh?.geometry;
      if (g && g !== EMPTY_GEOMETRY) g.dispose();
    };
  }, []);

  return (
    <mesh ref={meshRef} frustumCulled={false} visible={false}>
      {/* No geometry child — geometry is owned imperatively (see the effect above).
          R3F tolerates a <mesh> with no geometry child; it just uses three's
          throwaway default, which the mount effect immediately replaces. */}
      <CustomShaderMaterial
        baseMaterial={THREE.MeshBasicMaterial}
        vertexShader={pathVertexShader}
        fragmentShader={pathFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        toneMapped={false}
        fog={false}
      />
    </mesh>
  );
}

/** A shared, never-disposed empty placeholder so the mesh always has a geometry
 *  before the first rebuild (draws nothing; mesh.visible gates it anyway). */
const EMPTY_GEOMETRY = new THREE.BufferGeometry();


